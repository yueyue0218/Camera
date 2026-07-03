package com.action.camera.message.dto;

public record ConversationPresenceRequest(
        Long conversationId,
        Boolean active
) {
}
