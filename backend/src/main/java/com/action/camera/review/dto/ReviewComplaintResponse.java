package com.action.camera.review.dto;

import java.time.LocalDateTime;

public record ReviewComplaintResponse(
        Long complaintId,
        Long reviewId,
        Long orderId,
        Long complainantId,
        Long respondentId,
        String reason,
        String evidenceFileIds,
        String status,
        String arbitrationResult,
        String arbitrationComment,
        Long handledBy,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        LocalDateTime handledAt
) {
}
