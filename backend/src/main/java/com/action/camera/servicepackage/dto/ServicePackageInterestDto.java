package com.action.camera.servicepackage.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class ServicePackageInterestDto {

    private Long interestId;

    private Long userId;

    private Long serviceId;

    private LocalDateTime createdAt;
}
