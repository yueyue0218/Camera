package com.action.camera.message.service;

import com.action.camera.application.OrderDisplayService;
import com.action.camera.application.UserDisplayService;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.domain.FileRecord;
import com.action.camera.message.dto.MessageResponse;
import com.action.camera.message.entity.Conversation;
import com.action.camera.message.entity.Message;
import com.action.camera.message.repository.ConversationRepository;
import com.action.camera.message.repository.MessageRepository;
import com.action.camera.notification.dto.NotificationCreateRequest;
import com.action.camera.notification.service.NotificationService;
import com.action.camera.repository.FileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MessageService {

    public static final String MESSAGE_TYPE_TEXT = "TEXT";
    public static final String MESSAGE_TYPE_IMAGE = "IMAGE";
    public static final String MESSAGE_TYPE_FILE = "FILE";
    public static final String BIZ_TYPE_MESSAGE_ATTACHMENT = "MESSAGE_ATTACHMENT";
    private static final String MESSAGE_RECEIVED = "MESSAGE_RECEIVED";
    private static final String RELATED_CONVERSATION = "CONVERSATION";
    private static final String SOURCE_MESSAGE = "MESSAGE";

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final NotificationService notificationService;
    private final UserDisplayService userDisplayService;
    private final OrderDisplayService orderDisplayService;
    private final MessagePresenceService messagePresenceService;
    private final FileRepository fileRepository;

    @Transactional
    public Message sendTextMessage(Long conversationId, Long senderId, String content) {
        return sendMessage(conversationId, senderId, MESSAGE_TYPE_TEXT, content, null);
    }

    @Transactional
    public Message sendMessage(Long conversationId, Long senderId, String messageType, String content) {
        return sendMessage(conversationId, senderId, messageType, content, null);
    }

    @Transactional
    public Message sendMessage(Long conversationId, Long senderId, String messageType, String content, Long fileId) {
        Conversation conversation = getConversationOrThrow(conversationId);
        ensureParticipant(conversation, senderId);
        FileRecord attachment = fileId == null ? null : getMessageAttachmentOrThrow(fileId, senderId);
        String normalizedContent = normalizeContent(content);
        if (normalizedContent == null && attachment == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "message content or attachment must be provided");
        }
        String normalizedType = normalizeMessageType(messageType, attachment);

        LocalDateTime now = LocalDateTime.now();
        Message message = new Message();
        message.setConversationId(conversationId);
        message.setSenderId(senderId);
        message.setMessageType(normalizedType);
        message.setContent(normalizedContent);
        message.setFileId(attachment == null ? null : attachment.getId());
        message.setIsRead(false);
        message.setCreatedAt(now);
        Message savedMessage = messageRepository.save(message);

        conversation.setLastMessageTime(now);
        conversationRepository.save(conversation);
        notifyRecipientIfNeeded(conversation, savedMessage);
        return savedMessage;
    }

    @Transactional(readOnly = true)
    public List<MessageResponse> listMessageResponses(Long conversationId, Long operatorId) {
        List<Message> messages = listMessages(conversationId, operatorId);
        Map<Long, FileRecord> attachments = loadAttachments(messages);
        return messages.stream()
                .map(message -> MessageResponse.from(
                        message,
                        message.getFileId() == null ? null : attachments.get(message.getFileId())
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public MessageResponse toResponse(Message message) {
        if (message == null) {
            return null;
        }
        FileRecord attachment = message.getFileId() == null
                ? null
                : fileRepository.findById(message.getFileId()).orElse(null);
        return MessageResponse.from(message, attachment);
    }

    public void reportPresence(Long userId, Long conversationId, boolean active) {
        if (conversationId != null) {
            Conversation conversation = getConversationOrThrow(conversationId);
            ensureParticipant(conversation, userId);
        }
        messagePresenceService.reportPresence(userId, conversationId, active);
    }

    private String normalizeMessageType(String messageType, FileRecord attachment) {
        if (attachment != null) {
            return isImageAttachment(attachment) ? MESSAGE_TYPE_IMAGE : MESSAGE_TYPE_FILE;
        }
        if (messageType == null || messageType.isBlank()) {
            return MESSAGE_TYPE_TEXT;
        }
        String normalized = messageType.trim().toUpperCase();
        if (MESSAGE_TYPE_TEXT.equals(normalized) || MESSAGE_TYPE_IMAGE.equals(normalized)
                || MESSAGE_TYPE_FILE.equals(normalized)) {
            return normalized;
        }
        throw new BusinessException(ErrorCode.VALIDATION_ERROR, "unsupported message type: " + messageType);
    }

    @Transactional(readOnly = true)
    public List<Message> listMessages(Long conversationId, Long operatorId) {
        Conversation conversation = getConversationOrThrow(conversationId);
        ensureParticipant(conversation, operatorId);
        return messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId);
    }

    private FileRecord getMessageAttachmentOrThrow(Long fileId, Long senderId) {
        FileRecord file = fileRepository.findById(fileId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Attachment file not found"));
        if (!Objects.equals(file.getUploaderId(), senderId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only the uploader can send this attachment");
        }
        if (!BIZ_TYPE_MESSAGE_ATTACHMENT.equals(normalize(file.getBizType()))) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "file is not a message attachment");
        }
        if (!"PRIVATE".equals(normalize(file.getVisibility()))) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "message attachments must be private");
        }
        return file;
    }

    private Map<Long, FileRecord> loadAttachments(List<Message> messages) {
        List<Long> fileIds = messages.stream()
                .map(Message::getFileId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (fileIds.isEmpty()) {
            return Map.of();
        }
        return fileRepository.findAllById(fileIds).stream()
                .collect(Collectors.toMap(FileRecord::getId, Function.identity()));
    }

    private String normalizeContent(String content) {
        String text = content == null ? "" : content.trim();
        return text.isBlank() ? null : text;
    }

    private boolean isImageAttachment(FileRecord attachment) {
        return String.valueOf(attachment.getMimeType() == null ? "" : attachment.getMimeType())
                .toLowerCase(Locale.ROOT)
                .startsWith("image/");
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private Conversation getConversationOrThrow(Long conversationId) {
        if (conversationId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "conversationId must not be null");
        }
        return conversationRepository.findById(conversationId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND,
                        "Conversation not found: " + conversationId));
    }

    private void ensureParticipant(Conversation conversation, Long userId) {
        if (!conversation.hasParticipant(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only conversation participants can operate messages");
        }
    }

    private void notifyRecipientIfNeeded(Conversation conversation, Message message) {
        Long recipientId = resolveRecipientId(conversation, message.getSenderId());
        if (recipientId == null || !messagePresenceService.shouldCreateMessageNotification(recipientId, conversation.getId())) {
            return;
        }
        String senderName = userDisplayService.resolveDisplayName(message.getSenderId(), resolveSenderRole(conversation, message.getSenderId()));
        String content = buildNotificationContent(conversation, senderName);
        notificationService.createNotification(new NotificationCreateRequest(
                recipientId,
                message.getSenderId(),
                "收到一条新消息",
                content,
                MESSAGE_RECEIVED,
                MESSAGE_RECEIVED,
                RELATED_CONVERSATION,
                conversation.getId(),
                RELATED_CONVERSATION,
                conversation.getId(),
                SOURCE_MESSAGE,
                message.getId(),
                null,
                buildMessageMetadata(conversation, message, senderName)
        ));
    }

    private Long resolveRecipientId(Conversation conversation, Long senderId) {
        if (conversation == null || senderId == null) {
            return null;
        }
        if (senderId.equals(conversation.getParticipantAId())) {
            return conversation.getParticipantBId();
        }
        if (senderId.equals(conversation.getParticipantBId())) {
            return conversation.getParticipantAId();
        }
        return null;
    }

    private String resolveSenderRole(Conversation conversation, Long senderId) {
        if (conversation == null || senderId == null) {
            return "";
        }
        if (senderId.equals(conversation.getParticipantAId())) {
            return "CUSTOMER";
        }
        if (senderId.equals(conversation.getParticipantBId())) {
            return "PROVIDER";
        }
        return "";
    }

    private String buildNotificationContent(Conversation conversation, String senderName) {
        if (conversation != null && conversation.getOrderId() != null && conversation.getOrderId() > 0) {
            String orderSubject = orderDisplayService.resolveOrderSubject(conversation.getOrderId());
            return senderName + " 在" + orderSubject + "的会话中给你发来一条消息，点击查看会话。";
        }
        return senderName + " 给你发来一条消息，点击查看会话。";
    }

    private String buildMessageMetadata(Conversation conversation, Message message, String senderName) {
        String orderPart = conversation.getOrderId() != null && conversation.getOrderId() > 0
                ? "\"orderId\":" + conversation.getOrderId() + ","
                : "";
        return String.format(
                "{%s\"conversationId\":%d,\"messageId\":%d,\"actorNickname\":\"%s\",\"navigationPath\":\"/messages/%d\"}",
                orderPart,
                conversation.getId(),
                message.getId(),
                escapeJson(senderName),
                conversation.getId()
        );
    }

    private String escapeJson(String value) {
        return String.valueOf(value == null ? "" : value)
                .replace("\\", "\\\\")
                .replace("\"", "\\\"");
    }
}
