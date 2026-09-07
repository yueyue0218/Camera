package com.action.camera.auth.dto;

import java.time.LocalDateTime;

public record SessionResponse(
        Long userId,
        String nickname,
        String role,
        boolean adminCapable,
        String sessionId,
        String deviceId,
        String deviceName,
        LocalDateTime createdAt,
        LocalDateTime expiresAt
) {
}
