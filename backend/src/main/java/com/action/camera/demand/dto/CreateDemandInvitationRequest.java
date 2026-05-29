package com.action.camera.demand.dto;

public class CreateDemandInvitationRequest {

    private String message;
    private Integer expectedPriceCent;

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
