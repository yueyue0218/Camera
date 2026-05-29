package com.action.camera.demand.dto;

public class AcceptDemandResponseResult {

    private final Long responseId;
    private final Long demandId;
    private final Long customerId;
    private final Long providerId;
    private final String responseStatus;
    private final String conversationSourceType;
    private final Long sourceId;
    private final String nextAction;

    public AcceptDemandResponseResult(AcceptedDemandResponseSnapshot snapshot) {
        this.responseId = snapshot.getResponseId();
        this.demandId = snapshot.getDemandId();
        this.customerId = snapshot.getCustomerId();
        this.providerId = snapshot.getProviderId();
        this.responseStatus = snapshot.getResponseStatus();
        this.conversationSourceType = "DEMAND_RESPONSE";
        this.sourceId = snapshot.getResponseId();
        this.nextAction = "PASS_SNAPSHOT_TO_C_CREATE_CONVERSATION";
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

    public String getConversationSourceType() {
        return conversationSourceType;
    }

    public Long getSourceId() {
        return sourceId;
    }

    public String getNextAction() {
        return nextAction;
    }
}
