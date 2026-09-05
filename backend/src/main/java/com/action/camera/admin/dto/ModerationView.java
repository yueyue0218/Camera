package com.action.camera.admin.dto;

import com.action.camera.admin.domain.ModerationStatus;

import java.time.LocalDateTime;

public record ModerationView(
        ModerationStatus status,
        LocalDateTime moderatedAt,
        String reason
) {
}
