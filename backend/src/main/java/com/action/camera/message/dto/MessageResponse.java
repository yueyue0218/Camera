package com.action.camera.message.dto;

import com.action.camera.message.entity.Message;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class MessageResponse {

    private Long messageId;
    private Long conversationId;
    private Long senderId;
    private String messageType;
    private String content;
    private LocalDateTime createdAt;

    public static MessageResponse from(Message message) {
        return new MessageResponse(
                message.getId(),
                message.getConversationId(),
                message.getSenderId(),
                message.getMessageType(),
                message.getContent(),
                message.getCreatedAt()
        );
    }
}
