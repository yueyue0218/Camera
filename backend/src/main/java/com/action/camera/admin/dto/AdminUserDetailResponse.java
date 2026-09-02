package com.action.camera.admin.dto;

import java.time.LocalDateTime;
import java.util.List;

public record AdminUserDetailResponse(
        Long userId,
        String nickname,
        Long avatarFileId,
        String currentRole,
        boolean admin,
        String status,
        String school,
        String cityCode,
        String bio,
        LocalDateTime createdAt,
        String studentCertificationStatus,
        String realNameCertificationStatus,
        long publicDemandCount,
        long publicServicePackageCount,
        long publicMomentCount,
        long totalReportCount,
        long pendingReportCount,
        List<AuditRecordResponse> auditRecords
) {

    public record AuditRecordResponse(
            Long auditId,
            String targetType,
            Long targetId,
            Long adminId,
            String action,
            String reason,
            LocalDateTime createdAt
    ) {
    }
}
