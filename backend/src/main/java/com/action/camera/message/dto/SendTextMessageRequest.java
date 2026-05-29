package com.action.camera.message.dto;

import lombok.Data;

@Data
public class SendTextMessageRequest {

    private String messageType;
    private String content;
}
