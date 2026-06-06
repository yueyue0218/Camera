package com.action.camera.servicepackage.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ReserveServicePackageResult {

    private Long serviceId;

    private Long conversationId;

    private String status;

    private Boolean isAvailable;
}
