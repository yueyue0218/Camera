package com.action.camera.report.dto;

import java.time.LocalDateTime;

public record ReportResponse(
        Long reportId, Long reporterId, String targetType, Long targetId,
        String reason, String description, String status, Long adminId,
        String resolution, String adminComment,
        LocalDateTime createdAt, LocalDateTime resolvedAt,
        String publicOutcome, String publicMessage, Boolean followUpRecorded) {
    public ReportResponse(Long reportId, Long reporterId, String targetType, Long targetId,
                          String reason, String description, String status, Long adminId,
                          String resolution, String adminComment, LocalDateTime createdAt, LocalDateTime resolvedAt) {
        this(reportId, reporterId, targetType, targetId, reason, description, status, adminId,
                resolution, adminComment, createdAt, resolvedAt, null, null, null);
    }
}
