package com.action.camera.credit.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record CreditSummaryResponse(
        Long userId,
        BigDecimal creditScore,
        String creditLevel,
        Long recordCount,
        LocalDateTime lastUpdatedAt,
        Long effectiveOrderCount,
        Long completedOrderCount,
        BigDecimal goodReviewRate,
        BigDecimal defaultRate,
        Long riskRecordCount,
        Long receivedReviewCount,
        BigDecimal averageRating
) {
}
