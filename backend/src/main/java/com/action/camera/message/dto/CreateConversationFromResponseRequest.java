package com.action.camera.message.dto;

import lombok.Data;

@Data
public class CreateConversationFromResponseRequest {

    private Long responseId;
    private Long demandId;
    private Long customerId;
    private Long providerUserId;
    private String status;
}
