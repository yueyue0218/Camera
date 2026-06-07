package com.action.camera.credit.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record CreditRecordResponse(
        Long recordId,
        Long userId,
        Long relatedOrderId,
        String eventType,
        Integer scoreChange,
        BigDecimal beforeScore,
        BigDecimal scoreAfter,
        BigDecimal afterScore,
        Integer appliedScoreChange,
        String sourceType,
        Long sourceId,
        String reason,
        LocalDateTime createdAt
) {
    public CreditRecordResponse(Long recordId,
                                Long userId,
                                Long relatedOrderId,
                                String eventType,
                                Integer scoreChange,
                                BigDecimal scoreAfter,
                                String reason,
                                LocalDateTime createdAt) {
        this(recordId, userId, relatedOrderId, eventType, scoreChange, null, scoreAfter, scoreAfter, null, null, null, reason, createdAt);
    }
}
