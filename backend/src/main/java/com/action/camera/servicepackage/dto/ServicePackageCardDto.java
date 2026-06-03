package com.action.camera.servicepackage.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@AllArgsConstructor
public class ServicePackageCardDto {

    private Long serviceId;

    private Long providerId;

    private Long photographerId;

    private String photographerNickname;

    private Long photographerAvatarFileId;

    private String photographerAvatarUrl;

    private String title;

    private String cityCode;

    private String scene;

    private List<String> styleTags;

    private String coverImage;

    private List<String> images;

    private Long basePriceCent;

    private String priceRange;

    private Integer durationMinutes;

    private Long coverPortfolioId;

    private List<Long> portfolioIds;

    private String status;

    private Boolean isAvailable;

    private List<LocalDate> availableDates;

    private String timeDescription;

    private List<String> timeTags;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
