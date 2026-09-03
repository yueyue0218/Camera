package com.action.camera.report.dto;

public record ReportCreateRequest(String targetType, Long targetId, String reason, String description) {
}
