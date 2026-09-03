package com.action.camera.admin.dto;

import java.time.LocalDateTime;

public record AdminUserListItemResponse(
        Long userId,
        String nickname,
        Long avatarFileId,
        String currentRole,
        boolean admin,
        String status,
        String school,
        String cityCode,
        LocalDateTime createdAt,
        long pendingReportCount
) {
}
