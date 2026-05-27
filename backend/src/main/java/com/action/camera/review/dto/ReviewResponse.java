package com.action.camera.review.dto;

import java.time.LocalDateTime;

public record ReviewResponse(
        Long reviewId,
        Long orderId,
        Long reviewerId,
        Long targetUserId,
        String direction,
        Integer rating,
        String content,
        Boolean isVisible,
        LocalDateTime createdAt
) {
}
