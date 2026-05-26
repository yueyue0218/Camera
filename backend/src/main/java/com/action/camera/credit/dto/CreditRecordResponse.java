package com.action.camera.credit.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record CreditRecordResponse(
        Long recordId,
        Long userId,
        Long relatedOrderId,
        String eventType,
        Integer scoreChange,
        BigDecimal scoreAfter,
        String reason,
        LocalDateTime createdAt
) {
}
