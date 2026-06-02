package com.action.camera.servicepackage.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
@AllArgsConstructor
public class ServicePackageCardDto {

    private Long serviceId;

    private Long providerId;

    private String title;

    private String cityCode;

    private String scene;

    private List<String> styleTags;

    private Long basePriceCent;

    private Integer durationMinutes;

    private Long coverPortfolioId;

    private List<Long> portfolioIds;

    private String status;

    private Boolean isAvailable;

    private List<LocalDate> availableDates;
}
