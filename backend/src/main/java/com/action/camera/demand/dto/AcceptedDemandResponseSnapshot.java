package com.action.camera.demand.dto;

public class AcceptedDemandResponseSnapshot {

    private final Long responseId;
    private final Long demandId;
    private final Long customerId;
    private final Long providerId;
    private final String responseStatus;

    public AcceptedDemandResponseSnapshot(Long responseId,
                                          Long demandId,
                                          Long customerId,
                                          Long providerId,
                                          String responseStatus) {
        this.responseId = responseId;
        this.demandId = demandId;
        this.customerId = customerId;
        this.providerId = providerId;
        this.responseStatus = responseStatus;
    }

    public Long getResponseId() {
        return responseId;
    }

    public Long getDemandId() {
        return demandId;
    }

    public Long getCustomerId() {
        return customerId;
    }

    public Long getProviderId() {
        return providerId;
    }

    public String getResponseStatus() {
        return responseStatus;
    }
}
