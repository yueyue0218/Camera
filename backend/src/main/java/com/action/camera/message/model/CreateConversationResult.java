package com.action.camera.message.model;

public class CreateConversationResult {

    private final Long conversationId;

    public CreateConversationResult(Long conversationId) {
        this.conversationId = conversationId;
    }

    public Long getConversationId() {
        return conversationId;
    }
}
