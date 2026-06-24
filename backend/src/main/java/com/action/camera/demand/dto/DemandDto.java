package com.action.camera.demand.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public class DemandDto {

    private final Long demandId;
    private final Long customerId;
    private final String customerNickname;
    private final Long customerAvatarFileId;
    private final String scene;
    private final List<String> styleTags;
    private final LocalDate expectedDate;
    private final String timeSlot;
    private final String timeDescription;
    private final List<String> timeTags;
    private final String cityCode;
    private final String location;
    private final Integer budgetMinCent;
    private final Integer budgetMaxCent;
    private final String description;
    private final String status;
    private final int responseCount;
    private final Integer pendingCount;
    private final Integer acceptedCount;
    private final Integer rejectedCount;
    private final List<Long> referenceFileIds;
    private final List<String> recommendReasons;
    private final LocalDateTime createdAt;
    private final LocalDateTime updatedAt;

    public DemandDto(Long demandId,
                     Long customerId,
                     String scene,
                     List<String> styleTags,
                     LocalDate expectedDate,
                     String timeSlot,
                     String timeDescription,
                     List<String> timeTags,
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
        this(demandId, customerId, null, null, scene, styleTags, expectedDate, timeSlot, timeDescription, timeTags,
                cityCode, location, budgetMinCent, budgetMaxCent, description, status, responseCount,
                null, null, null, referenceFileIds, null, createdAt, updatedAt);
    }

    public DemandDto(Long demandId,
                     Long customerId,
                     String customerNickname,
                     Long customerAvatarFileId,
                     String scene,
                     List<String> styleTags,
                     LocalDate expectedDate,
                     String timeSlot,
                     String timeDescription,
                     List<String> timeTags,
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
        this(demandId, customerId, customerNickname, customerAvatarFileId, scene, styleTags, expectedDate,
                timeSlot, timeDescription, timeTags, cityCode, location, budgetMinCent, budgetMaxCent,
                description, status, responseCount, null, null, null, referenceFileIds, null, createdAt, updatedAt);
    }

    public DemandDto(Long demandId,
                     Long customerId,
                     String scene,
                     List<String> styleTags,
                     LocalDate expectedDate,
                     String timeSlot,
                     String timeDescription,
                     List<String> timeTags,
                     String cityCode,
                     String location,
                     Integer budgetMinCent,
                     Integer budgetMaxCent,
                     String description,
                     String status,
                     int responseCount,
                     Integer pendingCount,
                     Integer acceptedCount,
                     Integer rejectedCount,
                     List<Long> referenceFileIds,
                     LocalDateTime createdAt,
                     LocalDateTime updatedAt) {
        this.demandId = demandId;
        this.customerId = customerId;
        this.customerNickname = null;
        this.customerAvatarFileId = null;
        this.scene = scene;
        this.styleTags = styleTags;
        this.expectedDate = expectedDate;
        this.timeSlot = timeSlot;
        this.timeDescription = timeDescription;
        this.timeTags = timeTags;
        this.cityCode = cityCode;
        this.location = location;
        this.budgetMinCent = budgetMinCent;
        this.budgetMaxCent = budgetMaxCent;
        this.description = description;
        this.status = status;
        this.responseCount = responseCount;
        this.pendingCount = pendingCount;
        this.acceptedCount = acceptedCount;
        this.rejectedCount = rejectedCount;
        this.referenceFileIds = referenceFileIds;
        this.recommendReasons = List.of();
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public DemandDto(Long demandId,
                     Long customerId,
                     String customerNickname,
                     Long customerAvatarFileId,
                     String scene,
                     List<String> styleTags,
                     LocalDate expectedDate,
                     String timeSlot,
                     String timeDescription,
                     List<String> timeTags,
                     String cityCode,
                     String location,
                     Integer budgetMinCent,
                     Integer budgetMaxCent,
                     String description,
                     String status,
                     int responseCount,
                     Integer pendingCount,
                     Integer acceptedCount,
                     Integer rejectedCount,
                     List<Long> referenceFileIds,
                     LocalDateTime createdAt,
                     LocalDateTime updatedAt) {
        this(demandId, customerId, customerNickname, customerAvatarFileId, scene, styleTags, expectedDate,
                timeSlot, timeDescription, timeTags, cityCode, location, budgetMinCent, budgetMaxCent,
                description, status, responseCount, pendingCount, acceptedCount, rejectedCount,
                referenceFileIds, null, createdAt, updatedAt);
    }

    public DemandDto(Long demandId,
                     Long customerId,
                     String customerNickname,
                     Long customerAvatarFileId,
                     String scene,
                     List<String> styleTags,
                     LocalDate expectedDate,
                     String timeSlot,
                     String timeDescription,
                     List<String> timeTags,
                     String cityCode,
                     String location,
                     Integer budgetMinCent,
                     Integer budgetMaxCent,
                     String description,
                     String status,
                     int responseCount,
                     Integer pendingCount,
                     Integer acceptedCount,
                     Integer rejectedCount,
                     List<Long> referenceFileIds,
                     List<String> recommendReasons,
                     LocalDateTime createdAt,
                     LocalDateTime updatedAt) {
        this.demandId = demandId;
        this.customerId = customerId;
        this.customerNickname = customerNickname;
        this.customerAvatarFileId = customerAvatarFileId;
        this.scene = scene;
        this.styleTags = styleTags;
        this.expectedDate = expectedDate;
        this.timeSlot = timeSlot;
        this.timeDescription = timeDescription;
        this.timeTags = timeTags;
        this.cityCode = cityCode;
        this.location = location;
        this.budgetMinCent = budgetMinCent;
        this.budgetMaxCent = budgetMaxCent;
        this.description = description;
        this.status = status;
        this.responseCount = responseCount;
        this.pendingCount = pendingCount;
        this.acceptedCount = acceptedCount;
        this.rejectedCount = rejectedCount;
        this.referenceFileIds = referenceFileIds;
        this.recommendReasons = recommendReasons == null ? List.of() : recommendReasons;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public Long getDemandId() {
        return demandId;
    }

    public Long getCustomerId() {
        return customerId;
    }

    public String getCustomerNickname() {
        return customerNickname;
    }

    public Long getCustomerAvatarFileId() {
        return customerAvatarFileId;
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

    public String getTimeDescription() {
        return timeDescription;
    }

    public List<String> getTimeTags() {
        return timeTags;
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

    public Integer getPendingCount() {
        return pendingCount;
    }

    public Integer getAcceptedCount() {
        return acceptedCount;
    }

    public Integer getRejectedCount() {
        return rejectedCount;
    }

    public List<Long> getReferenceFileIds() {
        return referenceFileIds;
    }

    public List<String> getRecommendReasons() {
        return recommendReasons;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
