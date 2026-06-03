package com.action.camera.servicepackage.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@AllArgsConstructor
public class ServicePackageDetailDto {

    private Long serviceId;

    private Long providerId;

    private Long photographerId;

    private String photographerNickname;

    private Long photographerAvatarFileId;

    private String photographerAvatarUrl;

    private String title;

    private String cityCode;

    private String serviceArea;

    private String scene;

    private List<String> styleTags;

    private List<String> images;

    private Long basePriceCent;

    private String priceRange;

    private Integer durationMinutes;

    private Integer originalCount;

    private Integer refinedCount;

    private Integer deliveryDays;

    private List<LocalDate> availableDates;

    private List<Long> portfolioIds;

    private String description;

    private String timeDescription;

    private List<String> timeTags;

    private String status;

    private Boolean isAvailable;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
