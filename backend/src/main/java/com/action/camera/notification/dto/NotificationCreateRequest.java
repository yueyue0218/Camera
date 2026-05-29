package com.action.camera.notification.dto;

public record NotificationCreateRequest(
        Long userId,
        String title,
        String content,
        String type,
        String relatedType,
        Long relatedId
) {
}
