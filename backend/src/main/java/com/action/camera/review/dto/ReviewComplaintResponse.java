package com.action.camera.review.dto;

import java.time.LocalDateTime;

public record ReviewComplaintResponse(
        Long complaintId,
        Long reviewId,
        Long orderId,
        Long complainantId,
        String complainantNickname,
        Long respondentId,
        String respondentNickname,
        String reason,
        String evidenceFileIds,
        String status,
        String arbitrationResult,
        String arbitrationComment,
        Long handledBy,
        String handledByNickname,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        LocalDateTime handledAt
) {
}
