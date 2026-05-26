package com.action.camera.credit.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record CreditSummaryResponse(
        Long userId,
        BigDecimal creditScore,
        Long recordCount,
        LocalDateTime lastUpdatedAt
) {
}
