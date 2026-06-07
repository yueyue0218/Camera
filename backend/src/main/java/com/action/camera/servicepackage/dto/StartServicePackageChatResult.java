package com.action.camera.servicepackage.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class StartServicePackageChatResult {

    private Long serviceId;

    private Long conversationId;

    private String status;
}
