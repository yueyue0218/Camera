package com.action.camera.message.dto;

import com.action.camera.message.entity.Conversation;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class ConversationListItemResponse {

    private Long conversationId;
    private Long participantAId;
    private Long participantBId;
    private Long otherUserId;
    private String sourceType;
    private Long sourceId;
    private LocalDateTime lastMessageTime;
    private LocalDateTime createdAt;

    public static ConversationListItemResponse from(Conversation conversation, Long currentUserId) {
        Long otherUserId = currentUserId.equals(conversation.getParticipantAId())
                ? conversation.getParticipantBId()
                : conversation.getParticipantAId();
        return new ConversationListItemResponse(
                conversation.getId(),
                conversation.getParticipantAId(),
                conversation.getParticipantBId(),
                otherUserId,
                conversation.getSourceType(),
                conversation.getSourceId(),
                conversation.getLastMessageTime(),
                conversation.getCreatedAt()
        );
    }
}
