package com.action.camera.privacy.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity @Table(name="privacy_right_requests", uniqueConstraints=@UniqueConstraint(name="uk_privacy_right_idempotency",columnNames={"user_id","idempotency_key"}), indexes={@Index(name="idx_privacy_right_user",columnList="user_id,submitted_at"),@Index(name="idx_privacy_right_status",columnList="status,submitted_at")}) @Getter @Setter
public class PrivacyRightRequest {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="user_id",nullable=false) private Long userId;
    @Column(nullable=false,length=20) private String type;
    @Column(nullable=false,length=2000) private String description;
    @Column(nullable=false,length=20) private String status;
    @Column(name="idempotency_key",nullable=false,length=64) private String idempotencyKey;
    @Column(name="submitted_at",nullable=false) private LocalDateTime submittedAt;
    @Column(name="updated_at",nullable=false) private LocalDateTime updatedAt;
    @Column(name="response_due_at",nullable=false) private LocalDateTime responseDueAt;
    @Column(name="resolution_note",length=2000) private String resolutionNote;
    @Column(name="processed_at") private LocalDateTime processedAt;
    @Column(name="verification_note",length=500) private String verificationNote;
    @Column(name="processed_by") private Long processedBy;
}
