package com.action.camera.notification.dto;

import java.time.LocalDateTime;

public record NotificationResponse(
        Long notificationId,
        Long recipientUserId,
        Long actorUserId,
        String title,
        String content,
        String type,
        String eventType,
        String relatedType,
        Long relatedId,
        String targetType,
        Long targetId,
        String sourceType,
        Long sourceId,
        String dedupeKey,
        String metadataJson,
        Boolean isRead,
        LocalDateTime createdAt
) {
    public NotificationResponse(Long notificationId,
                                String title,
                                String content,
                                String type,
                                String relatedType,
                                Long relatedId,
                                Boolean isRead,
                                LocalDateTime createdAt) {
        this(notificationId, null, null, title, content, type, type, relatedType, relatedId,
                relatedType, relatedId, relatedType, relatedId, null, null, isRead, createdAt);
    }
}
