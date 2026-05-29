package com.action.camera.message.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.message.entity.Conversation;
import com.action.camera.message.entity.Message;
import com.action.camera.message.repository.ConversationRepository;
import com.action.camera.message.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MessageService {

    public static final String MESSAGE_TYPE_TEXT = "TEXT";
    public static final String MESSAGE_TYPE_IMAGE = "IMAGE";

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;

    @Transactional
    public Message sendTextMessage(Long conversationId, Long senderId, String content) {
        return sendMessage(conversationId, senderId, MESSAGE_TYPE_TEXT, content);
    }

    @Transactional
    public Message sendMessage(Long conversationId, Long senderId, String messageType, String content) {
        Conversation conversation = getConversationOrThrow(conversationId);
        ensureParticipant(conversation, senderId);
        String normalizedType = normalizeMessageType(messageType);
        if (content == null || content.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "message content must not be blank");
        }

        LocalDateTime now = LocalDateTime.now();
        Message message = new Message();
        message.setConversationId(conversationId);
        message.setSenderId(senderId);
        message.setMessageType(normalizedType);
        message.setContent(content);
        message.setIsRead(false);
        message.setCreatedAt(now);
        Message savedMessage = messageRepository.save(message);

        conversation.setLastMessageTime(now);
        conversationRepository.save(conversation);
        return savedMessage;
    }

    private String normalizeMessageType(String messageType) {
        if (messageType == null || messageType.isBlank()) {
            return MESSAGE_TYPE_TEXT;
        }
        String normalized = messageType.trim().toUpperCase();
        if (MESSAGE_TYPE_TEXT.equals(normalized) || MESSAGE_TYPE_IMAGE.equals(normalized)) {
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
}
