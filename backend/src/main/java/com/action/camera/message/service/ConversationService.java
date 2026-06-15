package com.action.camera.message.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.message.entity.Conversation;
import com.action.camera.message.entity.ConversationHiddenByUser;
import com.action.camera.message.model.AcceptedResponseSnapshot;
import com.action.camera.message.model.CreateConversationCommand;
import com.action.camera.message.model.CreateConversationResult;
import com.action.camera.message.repository.ConversationHiddenByUserRepository;
import com.action.camera.message.repository.ConversationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Comparator;
import java.util.List;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ConversationService {

    public static final String SOURCE_TYPE_DEMAND_RESPONSE = "DEMAND_RESPONSE";
    public static final String SOURCE_TYPE_SERVICE_PACKAGE = "SERVICE_PACKAGE";
    public static final String SOURCE_TYPE_PORTFOLIO = "PORTFOLIO";
    public static final String SOURCE_TYPE_DIRECT = "DIRECT";
    public static final String RESPONSE_STATUS_ACCEPTED = "ACCEPTED";
    public static final Long PENDING_ORDER_ID = 0L;
    private static final Set<String> SUPPORTED_SOURCE_TYPES = Set.of(
            SOURCE_TYPE_DEMAND_RESPONSE,
            SOURCE_TYPE_SERVICE_PACKAGE,
            SOURCE_TYPE_PORTFOLIO,
            SOURCE_TYPE_DIRECT
    );

    private final ConversationRepository conversationRepository;
    private final MessageService messageService;
    private final PlatformTransactionManager transactionManager;
    private final ConversationHiddenByUserRepository hiddenByUserRepository;

    @Autowired
    public ConversationService(ConversationRepository conversationRepository,
                               MessageService messageService,
                               PlatformTransactionManager transactionManager,
                               ConversationHiddenByUserRepository hiddenByUserRepository) {
        this.conversationRepository = conversationRepository;
        this.messageService = messageService;
        this.transactionManager = transactionManager;
        this.hiddenByUserRepository = hiddenByUserRepository;
    }

    public ConversationService(ConversationRepository conversationRepository,
                               MessageService messageService,
                               PlatformTransactionManager transactionManager) {
        this(conversationRepository, messageService, transactionManager, null);
    }

    @Transactional
    public Conversation createFromAcceptedResponse(AcceptedResponseSnapshot snapshot, Long operatorId) {
        validateAcceptedSnapshot(snapshot, operatorId);

        return conversationRepository
                .findBySourceTypeAndSourceIdAndParticipantAIdAndParticipantBIdAndOrderId(
                        SOURCE_TYPE_DEMAND_RESPONSE,
                        snapshot.getResponseId(),
                        snapshot.getCustomerId(),
                        snapshot.getProviderUserId(),
                        PENDING_ORDER_ID)
                .orElseGet(() -> conversationRepository.save(buildConversation(
                        new CreateConversationCommand(
                                snapshot.getCustomerId(),
                                snapshot.getProviderUserId(),
                                operatorId,
                                SOURCE_TYPE_DEMAND_RESPONSE,
                                snapshot.getResponseId(),
                                null),
                        SOURCE_TYPE_DEMAND_RESPONSE)));
    }

    public CreateConversationResult createConversationWithInitialMessage(CreateConversationCommand command) {
        String sourceType = validateCreateCommand(command);
        Long orderId = normalizeOrderId(command.getOrderId());
        CreateConversationResult result = executeInNewTransaction(status -> conversationRepository
                .findBySourceTypeAndSourceIdAndParticipantAIdAndParticipantBIdAndOrderId(
                        sourceType,
                        command.getSourceId(),
                        command.getCustomerId(),
                        command.getProviderId(),
                        orderId)
                .map(conversation -> reuseExistingConversation(command, sourceType, orderId, conversation))
                .orElseGet(() -> createConversationOrMarkRollback(command, sourceType, status)));
        if (result != null) {
            return result;
        }
        return findExistingConversationAfterUniqueConflict(command, sourceType);
    }

    @Transactional(readOnly = true)
    public List<Conversation> listMyConversations(Long operatorId) {
        if (operatorId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "operatorId must not be null");
        }
        List<Conversation> visibleConversations = conversationRepository
                .findByParticipantAIdOrParticipantBId(operatorId, operatorId)
                .stream()
                .filter(conversation -> conversation.hasParticipant(operatorId))
                .toList();
        Set<Long> hiddenIds = hiddenConversationIds(operatorId, visibleConversations);
        return visibleConversations.stream()
                .filter(conversation -> !hiddenIds.contains(conversation.getId()))
                .sorted(Comparator
                        .comparing(this::sortTime, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(Conversation::getId, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    @Transactional
    public void hideConversation(Long conversationId, Long operatorId) {
        if (operatorId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "operatorId must not be null");
        }
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND,
                        "Conversation not found: " + conversationId));
        if (!conversation.hasParticipant(operatorId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only conversation participants can hide it");
        }
        if (hiddenByUserRepository == null) {
            return;
        }
        hiddenByUserRepository.findByConversationIdAndUserId(conversationId, operatorId)
                .orElseGet(() -> hiddenByUserRepository.save(
                        new ConversationHiddenByUser(conversationId, operatorId)));
    }

    private Set<Long> hiddenConversationIds(Long operatorId, List<Conversation> conversations) {
        if (hiddenByUserRepository == null || conversations.isEmpty()) {
            return Set.of();
        }
        Set<Long> conversationIds = conversations.stream()
                .map(Conversation::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (conversationIds.isEmpty()) {
            return Set.of();
        }
        Set<Long> hiddenIds = hiddenByUserRepository.findHiddenConversationIds(operatorId, conversationIds);
        return hiddenIds == null ? Set.of() : hiddenIds;
    }

    private LocalDateTime sortTime(Conversation conversation) {
        if (conversation.getLastMessageTime() != null) {
            return conversation.getLastMessageTime();
        }
        return conversation.getCreatedAt();
    }

    private void validateAcceptedSnapshot(AcceptedResponseSnapshot snapshot, Long operatorId) {
        if (snapshot == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "accepted response snapshot must not be null");
        }
        if (snapshot.getResponseId() == null || snapshot.getDemandId() == null
                || snapshot.getCustomerId() == null || snapshot.getProviderUserId() == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "accepted response snapshot is incomplete");
        }
        if (!RESPONSE_STATUS_ACCEPTED.equals(snapshot.getStatus())) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                    "Demand response is not accepted: " + snapshot.getStatus());
        }
        if (!Objects.equals(snapshot.getCustomerId(), operatorId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only the customer can create conversation from response");
        }
    }

    private String validateCreateCommand(CreateConversationCommand command) {
        if (command == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "conversation command must not be null");
        }
        if (command.getCustomerId() == null || command.getProviderId() == null
                || command.getInitiatorId() == null || command.getSourceId() == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "conversation command is incomplete");
        }
        if (!Objects.equals(command.getInitiatorId(), command.getCustomerId())
                && !Objects.equals(command.getInitiatorId(), command.getProviderId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only conversation participants can initiate it");
        }
        if (command.getSourceType() == null || command.getSourceType().isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "sourceType must not be blank");
        }
        String sourceType = command.getSourceType().trim().toUpperCase(Locale.ROOT);
        if (!SUPPORTED_SOURCE_TYPES.contains(sourceType)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unsupported conversation sourceType: " + sourceType);
        }
        return sourceType;
    }

    private CreateConversationResult createConversationAndInitialMessage(CreateConversationCommand command,
                                                                         String sourceType) {
        Conversation savedConversation = conversationRepository.saveAndFlush(buildConversation(command, sourceType));
        String initialMessage = normalizeMessage(command.getInitialMessage());
        if (initialMessage != null) {
            messageService.sendTextMessage(savedConversation.getId(), command.getInitiatorId(), initialMessage);
        }
        return new CreateConversationResult(savedConversation.getId());
    }

    private CreateConversationResult createConversationOrMarkRollback(CreateConversationCommand command,
                                                                      String sourceType,
                                                                      org.springframework.transaction.TransactionStatus status) {
        try {
            return createConversationAndInitialMessage(command, sourceType);
        } catch (DataIntegrityViolationException ex) {
            status.setRollbackOnly();
            return null;
        }
    }

    private CreateConversationResult findExistingConversationAfterUniqueConflict(CreateConversationCommand command,
                                                                                String sourceType) {
        for (int attempt = 0; attempt < 5; attempt++) {
            java.util.Optional<Conversation> existing = executeInNewTransaction(status ->
                    findExistingConversation(command, sourceType));
            if (existing.isPresent()) {
                return reuseExistingConversation(
                        command,
                        sourceType,
                        normalizeOrderId(command.getOrderId()),
                        existing.get());
            }
            waitBeforeRetry();
        }
        throw new BusinessException(ErrorCode.STATUS_CONFLICT, "Conversation was created concurrently but cannot be loaded");
    }

    private CreateConversationResult reuseExistingConversation(CreateConversationCommand command,
                                                              String sourceType,
                                                              Long orderId,
                                                              Conversation conversation) {
        if (shouldRestoreServicePackagePreChat(command, sourceType, orderId)) {
            restoreConversationVisibility(conversation.getId(), command.getInitiatorId());
        }
        return new CreateConversationResult(conversation.getId());
    }

    private boolean shouldRestoreServicePackagePreChat(CreateConversationCommand command,
                                                       String sourceType,
                                                       Long orderId) {
        return SOURCE_TYPE_SERVICE_PACKAGE.equals(sourceType)
                && Objects.equals(PENDING_ORDER_ID, orderId)
                && Objects.equals(command.getInitiatorId(), command.getCustomerId());
    }

    private void restoreConversationVisibility(Long conversationId, Long userId) {
        if (hiddenByUserRepository == null || conversationId == null || userId == null) {
            return;
        }
        hiddenByUserRepository.deleteByConversationIdAndUserId(conversationId, userId);
    }

    private <T> T executeInNewTransaction(org.springframework.transaction.support.TransactionCallback<T> callback) {
        TransactionTemplate template = new TransactionTemplate(transactionManager);
        template.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        return template.execute(callback);
    }

    private void waitBeforeRetry() {
        try {
            Thread.sleep(20);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Interrupted while loading existing conversation");
        }
    }

    private java.util.Optional<Conversation> findExistingConversation(CreateConversationCommand command,
                                                                      String sourceType) {
        return conversationRepository.findBySourceTypeAndSourceIdAndParticipantAIdAndParticipantBIdAndOrderId(
                sourceType,
                command.getSourceId(),
                command.getCustomerId(),
                command.getProviderId(),
                normalizeOrderId(command.getOrderId()));
    }

    private String normalizeMessage(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private Conversation buildConversation(CreateConversationCommand command, String sourceType) {
        Conversation conversation = new Conversation();
        conversation.setParticipantAId(command.getCustomerId());
        conversation.setParticipantBId(command.getProviderId());
        conversation.setSourceType(sourceType);
        conversation.setSourceId(command.getSourceId());
        conversation.setOrderId(normalizeOrderId(command.getOrderId()));
        conversation.setCreatedAt(LocalDateTime.now());
        return conversation;
    }

    private Long normalizeOrderId(Long orderId) {
        return orderId == null ? PENDING_ORDER_ID : orderId;
    }
}
