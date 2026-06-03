package com.action.camera.servicepackage.dto;

import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
public class CreateServicePackageRequest {

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
}
