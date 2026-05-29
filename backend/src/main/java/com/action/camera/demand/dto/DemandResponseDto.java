package com.action.camera.demand.dto;

import java.time.LocalDateTime;

public class DemandResponseDto {

    private final Long responseId;
    private final Long demandId;
    private final Long providerId;
    private final Long providerProfileId;
    private final String message;
    private final Integer expectedPriceCent;
    private final String status;
    private final String rejectReason;
    private final LocalDateTime responseTime;

    public DemandResponseDto(Long responseId,
                             Long demandId,
                             Long providerId,
                             Long providerProfileId,
                             String message,
                             Integer expectedPriceCent,
                             String status,
                             String rejectReason,
                             LocalDateTime responseTime) {
        this.responseId = responseId;
        this.demandId = demandId;
        this.providerId = providerId;
        this.providerProfileId = providerProfileId;
        this.message = message;
        this.expectedPriceCent = expectedPriceCent;
        this.status = status;
        this.rejectReason = rejectReason;
        this.responseTime = responseTime;
    }

    public Long getResponseId() {
        return responseId;
    }

    public Long getDemandId() {
        return demandId;
    }

    public Long getProviderId() {
        return providerId;
    }

    public Long getProviderProfileId() {
        return providerProfileId;
    }

    public String getMessage() {
        return message;
    }

    public Integer getExpectedPriceCent() {
        return expectedPriceCent;
    }

    public String getStatus() {
        return status;
    }

    public String getRejectReason() {
        return rejectReason;
    }

    public LocalDateTime getResponseTime() {
        return responseTime;
    }
}
