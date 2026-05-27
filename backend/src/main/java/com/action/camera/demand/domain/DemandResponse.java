package com.action.camera.demand.domain;

import java.time.LocalDateTime;

public class DemandResponse {

    private final Long id;
    private final Long demandId;
    private final Long providerId;
    private final Long providerProfileId;
    private final String message;
    private final Integer expectedPriceCent;
    private DemandResponseStatus status;
    private String rejectReason;
    private final LocalDateTime responseTime;

    public DemandResponse(Long id,
                          Long demandId,
                          Long providerId,
                          Long providerProfileId,
                          String message,
                          Integer expectedPriceCent,
                          LocalDateTime responseTime) {
        this.id = id;
        this.demandId = demandId;
        this.providerId = providerId;
        this.providerProfileId = providerProfileId;
        this.message = message;
        this.expectedPriceCent = expectedPriceCent;
        this.status = DemandResponseStatus.PENDING_CUSTOMER_ACCEPT;
        this.responseTime = responseTime;
    }

    public void accept() {
        this.status = DemandResponseStatus.ACCEPTED;
        this.rejectReason = null;
    }

    public void reject(String reason) {
        this.status = DemandResponseStatus.REJECTED;
        this.rejectReason = reason;
    }

    public Long getId() {
        return id;
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

    public DemandResponseStatus getStatus() {
        return status;
    }

    public String getRejectReason() {
        return rejectReason;
    }

    public LocalDateTime getResponseTime() {
        return responseTime;
    }
}
