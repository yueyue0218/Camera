package com.action.camera.message.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.message.entity.Conversation;
import com.action.camera.message.entity.Quote;
import com.action.camera.message.enums.QuoteStatus;
import com.action.camera.message.model.CreateQuoteCommand;
import com.action.camera.message.repository.ConversationRepository;
import com.action.camera.message.repository.QuoteRepository;
import com.action.camera.order.entity.Order;
import com.action.camera.order.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class QuoteService {

    private final QuoteRepository quoteRepository;
    private final ConversationRepository conversationRepository;
    private final OrderService orderService;

    @Transactional
    public Quote createQuoteFromConversation(CreateQuoteCommand command, Long operatorId) {
        validateCreateQuoteCommand(command);
        Conversation conversation = conversationRepository.findById(command.getConversationId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND,
                        "Conversation not found: " + command.getConversationId()));

        if (!Objects.equals(conversation.getParticipantBId(), operatorId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only the provider can create quote in this conversation");
        }
        if (quoteRepository.findFirstByConversationIdAndStatus(
                command.getConversationId(), QuoteStatus.PENDING_CONFIRM).isPresent()) {
            throw new BusinessException(ErrorCode.DUPLICATE_OPERATION,
                    "Conversation already has a pending quote: " + command.getConversationId());
        }

        Quote quote = buildPendingQuote(command, conversation);
        return quoteRepository.save(quote);
    }

    @Transactional
    public Order confirmQuote(Long quoteId, Long operatorId, String confirmRemark) {
        Quote quote = getQuoteOrThrow(quoteId);
        ensureCustomerOperator(quote, operatorId);

        if (quote.getStatus() == QuoteStatus.CONFIRMED) {
            return orderService.createOrderFromConfirmedQuote(quote);
        }
        if (quote.getStatus() != QuoteStatus.PENDING_CONFIRM) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                    "Quote status does not allow confirmation: " + quote.getStatus());
        }

        quote.setStatus(QuoteStatus.CONFIRMED);
        quote.setUpdatedAt(LocalDateTime.now());
        quoteRepository.save(quote);
        return orderService.createOrderFromConfirmedQuote(quote);
    }

    @Transactional
    public Quote rejectQuote(Long quoteId, Long operatorId, String rejectReason) {
        Quote quote = getQuoteOrThrow(quoteId);
        ensureCustomerOperator(quote, operatorId);

        if (quote.getStatus() != QuoteStatus.PENDING_CONFIRM) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                    "Quote status does not allow rejection: " + quote.getStatus());
        }

        quote.setStatus(QuoteStatus.REJECTED);
        quote.setRemark(mergeRemark(quote.getRemark(), rejectReason));
        quote.setUpdatedAt(LocalDateTime.now());
        return quoteRepository.save(quote);
    }

    @Transactional(readOnly = true)
    public List<Quote> listQuotesInConversation(Long conversationId, QuoteStatus status, Long operatorId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND,
                        "Conversation not found: " + conversationId));
        if (!conversation.hasParticipant(operatorId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN,
                    "Only conversation participants can view quotes");
        }
        if (status == null) {
            return quoteRepository.findByConversationIdOrderByCreatedAtDesc(conversationId);
        }
        return quoteRepository.findByConversationIdAndStatusOrderByCreatedAtDesc(conversationId, status);
    }

    private Quote getQuoteOrThrow(Long quoteId) {
        if (quoteId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "quoteId must not be null");
        }
        return quoteRepository.findById(quoteId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Quote not found: " + quoteId));
    }

    private void ensureCustomerOperator(Quote quote, Long operatorId) {
        if (operatorId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "operatorId must not be null");
        }
        if (!Objects.equals(quote.getCustomerId(), operatorId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only the customer can operate this quote");
        }
    }

    private String mergeRemark(String originalRemark, String operationRemark) {
        if (operationRemark == null || operationRemark.isBlank()) {
            return originalRemark;
        }
        if (originalRemark == null || originalRemark.isBlank()) {
            return operationRemark;
        }
        return originalRemark + "\nReject reason: " + operationRemark;
    }

    private void validateCreateQuoteCommand(CreateQuoteCommand command) {
        if (command == null || command.getConversationId() == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "conversationId must not be null");
        }
        if (command.getAmountCent() == null || command.getAmountCent() <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "quote amount must be positive");
        }
        if (command.getShootStartTime() == null || command.getShootEndTime() == null
                || !command.getShootStartTime().isBefore(command.getShootEndTime())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "shootStartTime must be before shootEndTime");
        }
        if (command.getLocation() == null || command.getLocation().isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "location must not be blank");
        }
        if (command.getServiceContent() == null || command.getServiceContent().trim().isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "serviceContent must not be blank");
        }
        if (command.getDeliveryDeadline() == null
                || !command.getDeliveryDeadline().isAfter(command.getShootEndTime())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "deliveryDeadline must be after shootEndTime");
        }
        if (command.getOriginalCount() != null && command.getOriginalCount() < 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "originalCount must not be negative");
        }
        if (command.getRefinedCount() != null && command.getRefinedCount() < 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "refinedCount must not be negative");
        }
    }

    private Quote buildPendingQuote(CreateQuoteCommand command, Conversation conversation) {
        LocalDateTime now = LocalDateTime.now();
        Quote quote = new Quote();
        quote.setQuoteNo("Q" + now.format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
                + conversation.getId() + Math.abs(System.nanoTime() % 10000));
        quote.setConversationId(conversation.getId());
        quote.setProviderUserId(conversation.getParticipantBId());
        quote.setCustomerId(conversation.getParticipantAId());
        quote.setSourceType(conversation.getSourceType());
        quote.setSourceId(conversation.getSourceId());
        quote.setAmountCent(command.getAmountCent());
        quote.setShootStartTime(command.getShootStartTime());
        quote.setShootEndTime(command.getShootEndTime());
        quote.setLocation(command.getLocation());
        quote.setServiceContent(command.getServiceContent());
        quote.setOriginalCount(defaultNonNegative(command.getOriginalCount()));
        quote.setRefinedCount(defaultNonNegative(command.getRefinedCount()));
        quote.setDeliveryDeadline(command.getDeliveryDeadline());
        quote.setPhotoUsageScope(defaultText(command.getPhotoUsageScope(), "PERSONAL_ONLY"));
        quote.setTerms(command.getTerms());
        quote.setContractTerms(command.getContractTerms());
        quote.setSafetyNoticeVersion(command.getSafetyNoticeVersion());
        quote.setServiceSnapshotJson(buildServiceSnapshot(command));
        quote.setRemark(command.getRemark());
        quote.setStatus(QuoteStatus.PENDING_CONFIRM);
        quote.setExpireTime(command.getExpireTime() == null ? now.plusDays(1) : command.getExpireTime());
        quote.setCreatedAt(now);
        quote.setUpdatedAt(now);
        return quote;
    }

    private Integer defaultNonNegative(Integer value) {
        return value == null ? 0 : value;
    }

    private String defaultText(String value, String defaultValue) {
        return value == null || value.isBlank() ? defaultValue : value;
    }

    private String buildServiceSnapshot(CreateQuoteCommand command) {
        return "{"
                + "\"amountCent\":" + command.getAmountCent()
                + ",\"location\":\"" + escape(command.getLocation()) + "\""
                + ",\"serviceContent\":\"" + escape(command.getServiceContent()) + "\""
                + ",\"originalCount\":" + defaultNonNegative(command.getOriginalCount())
                + ",\"refinedCount\":" + defaultNonNegative(command.getRefinedCount())
                + ",\"photoUsageScope\":\"" + escape(defaultText(command.getPhotoUsageScope(), "PERSONAL_ONLY")) + "\""
                + "}";
    }

    private String escape(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
