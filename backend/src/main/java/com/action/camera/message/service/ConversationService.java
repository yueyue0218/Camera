package com.action.camera.message.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.message.entity.Conversation;
import com.action.camera.message.model.AcceptedResponseSnapshot;
import com.action.camera.message.model.CreateConversationCommand;
import com.action.camera.message.model.CreateConversationResult;
import com.action.camera.message.repository.ConversationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ConversationService {

    public static final String SOURCE_TYPE_DEMAND_RESPONSE = "DEMAND_RESPONSE";
    public static final String SOURCE_TYPE_SERVICE_PACKAGE = "SERVICE_PACKAGE";
    public static final String SOURCE_TYPE_PORTFOLIO = "PORTFOLIO";
    public static final String SOURCE_TYPE_DIRECT = "DIRECT";
    public static final String RESPONSE_STATUS_ACCEPTED = "ACCEPTED";
    private static final Set<String> SUPPORTED_SOURCE_TYPES = Set.of(
            SOURCE_TYPE_DEMAND_RESPONSE,
            SOURCE_TYPE_SERVICE_PACKAGE,
            SOURCE_TYPE_PORTFOLIO,
            SOURCE_TYPE_DIRECT
    );

    private final ConversationRepository conversationRepository;
    private final MessageService messageService;

    @Transactional
    public Conversation createFromAcceptedResponse(AcceptedResponseSnapshot snapshot, Long operatorId) {
        validateAcceptedSnapshot(snapshot, operatorId);

        return conversationRepository
                .findBySourceTypeAndSourceIdAndParticipantAIdAndParticipantBId(
                        SOURCE_TYPE_DEMAND_RESPONSE,
                        snapshot.getResponseId(),
                        snapshot.getCustomerId(),
                        snapshot.getProviderUserId())
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

    @Transactional
    public CreateConversationResult createConversationWithInitialMessage(CreateConversationCommand command) {
        String sourceType = validateCreateCommand(command);
        return conversationRepository
                .findBySourceTypeAndSourceIdAndParticipantAIdAndParticipantBId(
                        sourceType,
                        command.getSourceId(),
                        command.getCustomerId(),
                        command.getProviderId())
                .map(conversation -> new CreateConversationResult(conversation.getId()))
                .orElseGet(() -> createConversationAndInitialMessage(command, sourceType));
    }

    @Transactional(readOnly = true)
    public List<Conversation> listMyConversations(Long operatorId) {
        if (operatorId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "operatorId must not be null");
        }
        return conversationRepository.findByParticipantAIdOrParticipantBId(operatorId, operatorId)
                .stream()
                .filter(conversation -> conversation.hasParticipant(operatorId))
                .sorted(Comparator
                        .comparing(this::sortTime, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(Conversation::getId, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
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
        Conversation savedConversation = conversationRepository.save(buildConversation(command, sourceType));
        String initialMessage = normalizeMessage(command.getInitialMessage());
        if (initialMessage != null) {
            messageService.sendTextMessage(savedConversation.getId(), command.getInitiatorId(), initialMessage);
        }
        return new CreateConversationResult(savedConversation.getId());
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
        conversation.setCreatedAt(LocalDateTime.now());
        return conversation;
    }
}
