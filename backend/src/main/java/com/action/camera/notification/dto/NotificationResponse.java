package com.action.camera.notification.dto;

import java.time.LocalDateTime;

public record NotificationResponse(
        Long notificationId,
        String title,
        String content,
        String type,
        String relatedType,
        Long relatedId,
        Boolean isRead,
        LocalDateTime createdAt
) {
}
