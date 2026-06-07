package com.action.camera.notification.dto;

public record NotificationCreateRequest(
        Long userId,
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
        String metadataJson
) {
    public NotificationCreateRequest(Long userId,
                                     String title,
                                     String content,
                                     String type,
                                     String relatedType,
                                     Long relatedId) {
        this(userId, null, title, content, type, type, relatedType, relatedId,
                relatedType, relatedId, relatedType, relatedId, null, null);
    }
}
