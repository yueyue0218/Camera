package com.action.camera.demand.domain;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class Demand {

    private final Long id;
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
    private final List<Long> referenceFileIds;
    private DemandStatus status;
    private int responseCount;
    private final LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private final LocalDateTime expireTime;

    public Demand(Long id,
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
                  List<Long> referenceFileIds,
                  LocalDateTime createdAt,
                  LocalDateTime expireTime) {
        this.id = id;
        this.customerId = customerId;
        this.scene = scene;
        this.styleTags = copyList(styleTags);
        this.expectedDate = expectedDate;
        this.timeSlot = timeSlot;
        this.cityCode = cityCode;
        this.location = location;
        this.budgetMinCent = budgetMinCent;
        this.budgetMaxCent = budgetMaxCent;
        this.description = description;
        this.referenceFileIds = copyList(referenceFileIds);
        this.status = DemandStatus.OPEN;
        this.responseCount = 0;
        this.createdAt = createdAt;
        this.updatedAt = createdAt;
        this.expireTime = expireTime;
    }

    private static <T> List<T> copyList(List<T> source) {
        if (source == null) {
            return Collections.emptyList();
        }
        return Collections.unmodifiableList(new ArrayList<>(source));
    }

    public void increaseResponseCount() {
        responseCount++;
        touch();
    }

    public void markMatched() {
        status = DemandStatus.MATCHED;
        touch();
    }

    public void close() {
        status = DemandStatus.CLOSED;
        touch();
    }

    private void touch() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
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

    public List<Long> getReferenceFileIds() {
        return referenceFileIds;
    }

    public DemandStatus getStatus() {
        return status;
    }

    public int getResponseCount() {
        return responseCount;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public LocalDateTime getExpireTime() {
        return expireTime;
    }
}
