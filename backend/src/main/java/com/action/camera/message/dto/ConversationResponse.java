package com.action.camera.message.dto;

import com.action.camera.message.entity.Conversation;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class ConversationResponse {

    private Long conversationId;
    private Long participantAId;
    private Long participantBId;
    private String sourceType;
    private Long sourceId;
    private LocalDateTime lastMessageTime;
    private LocalDateTime createdAt;

    public static ConversationResponse from(Conversation conversation) {
        return new ConversationResponse(
                conversation.getId(),
                conversation.getParticipantAId(),
                conversation.getParticipantBId(),
                conversation.getSourceType(),
                conversation.getSourceId(),
                conversation.getLastMessageTime(),
                conversation.getCreatedAt()
        );
    }
}
