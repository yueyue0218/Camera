package com.action.camera.dispute.dto;

import java.time.LocalDateTime;
import java.util.List;

public record DisputeResponse(
        Long id,
        Long orderId,
        Long initiatorId,
        String reason,
        String status,
        String resolution,
        Long adminId,
        String adminComment,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        LocalDateTime resolvedAt,
        List<DisputeReplyResponse> replies
) {
}
