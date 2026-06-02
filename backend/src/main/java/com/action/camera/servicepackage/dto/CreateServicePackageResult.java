package com.action.camera.servicepackage.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class CreateServicePackageResult {

    private Long serviceId;

    private String status;

    private Boolean isAvailable;
}
