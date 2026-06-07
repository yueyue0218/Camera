package com.action.camera.admin.dto;

public record AdminDashboardResponse(
        long totalUsers,
        long todayGmvCent,
        long pendingAuditCount,
        long pendingArbitrationCount
) {
}
