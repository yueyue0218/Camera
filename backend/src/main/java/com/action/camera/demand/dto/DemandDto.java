package com.action.camera.demand.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public class DemandDto {

    private final Long demandId;
    private final Long customerId;
    private final String scene;
    private final List<String> styleTags;
    private final LocalDate expectedDate;
    private final String timeSlot;
    private final String cityCode;
    private final String location;
    private final Integer budgetMinCent;
    private final Integer budgetMaxCent;
    private final String description;
    private final String status;
    private final int responseCount;
    private final List<Long> referenceFileIds;
    private final LocalDateTime createdAt;
    private final LocalDateTime updatedAt;

    public DemandDto(Long demandId,
                     Long customerId,
                     String scene,
                     List<String> styleTags,
                     LocalDate expectedDate,
                     String timeSlot,
                     String cityCode,
                     String location,
                     Integer budgetMinCent,
                     Integer budgetMaxCent,
                     String description,
                     String status,
                     int responseCount,
                     List<Long> referenceFileIds,
                     LocalDateTime createdAt,
                     LocalDateTime updatedAt) {
        this.demandId = demandId;
        this.customerId = customerId;
        this.scene = scene;
        this.styleTags = styleTags;
        this.expectedDate = expectedDate;
        this.timeSlot = timeSlot;
        this.cityCode = cityCode;
        this.location = location;
        this.budgetMinCent = budgetMinCent;
        this.budgetMaxCent = budgetMaxCent;
        this.description = description;
        this.status = status;
        this.responseCount = responseCount;
        this.referenceFileIds = referenceFileIds;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public Long getDemandId() {
        return demandId;
    }

    public Long getCustomerId() {
        return customerId;
    }

    public String getScene() {
        return scene;
    }

    public List<String> getStyleTags() {
        return styleTags;
    }

    public LocalDate getExpectedDate() {
        return expectedDate;
    }

    public String getTimeSlot() {
        return timeSlot;
    }

    public String getCityCode() {
        return cityCode;
    }

    public String getLocation() {
        return location;
    }

    public Integer getBudgetMinCent() {
        return budgetMinCent;
    }

    public Integer getBudgetMaxCent() {
        return budgetMaxCent;
    }

    public String getDescription() {
        return description;
    }

    public String getStatus() {
        return status;
    }

    public int getResponseCount() {
        return responseCount;
    }

    public List<Long> getReferenceFileIds() {
        return referenceFileIds;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
