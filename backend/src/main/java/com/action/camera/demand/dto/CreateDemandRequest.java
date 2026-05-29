package com.action.camera.demand.dto;

import java.time.LocalDate;
import java.util.List;

public class CreateDemandRequest {

    private String scene;
    private List<String> styleTags;
    private LocalDate expectedDate;
    private String timeSlot;
    private String cityCode;
    private String location;
    private Integer budgetMinCent;
    private Integer budgetMaxCent;
    private String description;
    private List<Long> referenceFileIds;

    public String getScene() {
        return scene;
    }

    public void setScene(String scene) {
        this.scene = scene;
    }

    public List<String> getStyleTags() {
        return styleTags;
    }

    public void setStyleTags(List<String> styleTags) {
        this.styleTags = styleTags;
    }

    public LocalDate getExpectedDate() {
        return expectedDate;
    }

    public void setExpectedDate(LocalDate expectedDate) {
        this.expectedDate = expectedDate;
    }

    public String getTimeSlot() {
        return timeSlot;
    }

    public void setTimeSlot(String timeSlot) {
        this.timeSlot = timeSlot;
    }

    public String getCityCode() {
        return cityCode;
    }

    public void setCityCode(String cityCode) {
        this.cityCode = cityCode;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public Integer getBudgetMinCent() {
        return budgetMinCent;
    }

    public void setBudgetMinCent(Integer budgetMinCent) {
        this.budgetMinCent = budgetMinCent;
    }

    public Integer getBudgetMaxCent() {
        return budgetMaxCent;
    }

    public void setBudgetMaxCent(Integer budgetMaxCent) {
        this.budgetMaxCent = budgetMaxCent;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public List<Long> getReferenceFileIds() {
        return referenceFileIds;
    }

    public void setReferenceFileIds(List<Long> referenceFileIds) {
        this.referenceFileIds = referenceFileIds;
    }
}
