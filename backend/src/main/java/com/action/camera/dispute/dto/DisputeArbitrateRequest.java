package com.action.camera.dispute.dto;

public record DisputeArbitrateRequest(
        String resolution,
        String responsibility,
        Long refundAmount,
        String comment
) {

    public DisputeArbitrateRequest(String resolution, String comment) {
        this(resolution, null, null, comment);
    }
}
