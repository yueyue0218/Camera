package com.action.camera.demand.dto;

public class CreateDemandResponseRequest {

    private Long providerProfileId;
    private String message;
    private Integer expectedPriceCent;

    public Long getProviderProfileId() {
        return providerProfileId;
    }

    public void setProviderProfileId(Long providerProfileId) {
        this.providerProfileId = providerProfileId;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public Integer getExpectedPriceCent() {
        return expectedPriceCent;
    }

    public void setExpectedPriceCent(Integer expectedPriceCent) {
        this.expectedPriceCent = expectedPriceCent;
    }
}
