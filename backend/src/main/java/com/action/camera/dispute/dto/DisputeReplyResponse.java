package com.action.camera.dispute.dto;

import java.time.LocalDateTime;

public record DisputeReplyResponse(
        Long id,
        Long disputeId,
        Long replierId,
        String content,
        LocalDateTime createdAt
) {
}
