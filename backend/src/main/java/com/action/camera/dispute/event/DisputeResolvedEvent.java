package com.action.camera.dispute.event;

import org.springframework.context.ApplicationEvent;

public class DisputeResolvedEvent extends ApplicationEvent {

    private final Long disputeId;
    private final Long orderId;
    private final String resolution;

    public DisputeResolvedEvent(Object source, Long disputeId, Long orderId, String resolution) {
        super(source);
        this.disputeId = disputeId;
        this.orderId = orderId;
        this.resolution = resolution;
    }

    public Long getDisputeId() {
        return disputeId;
    }

    public Long getOrderId() {
        return orderId;
    }

    public String getResolution() {
        return resolution;
    }
}
