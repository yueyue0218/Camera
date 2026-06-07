package com.action.camera.notification.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Entity
@Table(
        name = "notifications",
        uniqueConstraints = @UniqueConstraint(name = "uk_notifications_dedupe", columnNames = "dedupe_key"),
        indexes = {
                @Index(name = "idx_notifications_user_read_created", columnList = "user_id, is_read, created_at"),
                @Index(name = "idx_notifications_target", columnList = "target_type, target_id")
        }
)
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;

    private Long actorUserId;

    private String title;

    private String content;

    private String type;

    private String eventType;

    private String relatedType;

    private Long relatedId;

    private String targetType;

    private Long targetId;

    private String sourceType;

    private Long sourceId;

    private String dedupeKey;

    private String metadataJson;

    private Boolean isRead;

    private LocalDateTime createdAt;
}
