package com.action.camera.report.domain;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "reports",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_reports_active_dedupe",
                columnNames = "active_dedupe_key"),
        indexes = {
                @Index(name = "idx_reports_status_created", columnList = "status,created_at"),
                @Index(name = "idx_reports_target_status", columnList = "target_type,target_id,status"),
                @Index(name = "idx_reports_reporter_created", columnList = "reporter_id,created_at")
        })
public class Report {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "reporter_id", nullable = false)
    private Long reporterId;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 30)
    private ReportTargetType targetType;

    @Column(name = "target_id", nullable = false)
    private Long targetId;

    @Column(name = "reason", nullable = false, length = 500)
    private String reason;

    @Column(name = "description", length = 1000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ReportStatus status = ReportStatus.PENDING;

    @Column(name = "admin_id")
    private Long adminId;

    @Enumerated(EnumType.STRING)
    @Column(name = "resolution", length = 30)
    private ReportResolution resolution;

    @Column(name = "admin_comment", length = 1000)
    private String adminComment;

    @Column(name = "active_dedupe_key", length = 160)
    private String activeDedupeKey;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    public static Report create(Long reporterId,
                                ReportTargetType targetType,
                                Long targetId,
                                String reason,
                                String description,
                                LocalDateTime now) {
        requireId(reporterId, "reporterId");
        if (targetType == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "targetType must not be null");
        }
        requireId(targetId, "targetId");
        LocalDateTime createdAt = requireTime(now);

        Report report = new Report();
        report.reporterId = reporterId;
        report.targetType = targetType;
        report.targetId = targetId;
        report.reason = normalizeRequired(reason, 500, "reason");
        report.description = normalizeOptional(description, 1000, "description");
        report.status = ReportStatus.PENDING;
        report.activeDedupeKey = reporterId + ":" + targetType.name() + ":" + targetId;
        report.createdAt = createdAt;
        report.updatedAt = createdAt;
        return report;
    }

    public void resolve(Long adminId,
                        ReportResolution resolution,
                        String adminComment,
                        LocalDateTime now) {
        if (!ReportStatus.PENDING.equals(status)) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "Report has already been resolved");
        }
        requireId(adminId, "adminId");
        if (resolution == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "resolution must not be null");
        }
        LocalDateTime resolutionTime = requireTime(now);

        this.adminId = adminId;
        this.resolution = resolution;
        this.adminComment = normalizeOptional(adminComment, 1000, "adminComment");
        this.status = ReportStatus.RESOLVED;
        this.activeDedupeKey = null;
        this.resolvedAt = resolutionTime;
        this.updatedAt = resolutionTime;
    }

    @PrePersist
    void prePersist() {
        if (status == null) {
            status = ReportStatus.PENDING;
        }
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (updatedAt == null) {
            updatedAt = createdAt;
        }
        if (ReportStatus.PENDING.equals(status) && activeDedupeKey == null
                && reporterId != null && targetType != null && targetId != null) {
            activeDedupeKey = reporterId + ":" + targetType.name() + ":" + targetId;
        }
    }

    @PreUpdate
    void preUpdate() {
        if (updatedAt == null) {
            updatedAt = LocalDateTime.now();
        }
        if (ReportStatus.RESOLVED.equals(status)) {
            activeDedupeKey = null;
        }
    }

    private static void requireId(Long value, String field) {
        if (value == null || value <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, field + " must be positive");
        }
    }

    private static LocalDateTime requireTime(LocalDateTime value) {
        if (value == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "now must not be null");
        }
        return value;
    }

    private static String normalizeRequired(String value, int maxLength, String field) {
        String normalized = normalizeOptional(value, maxLength, field);
        if (normalized == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, field + " must not be blank");
        }
        return normalized;
    }

    private static String normalizeOptional(String value, int maxLength, String field) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        if (normalized.isEmpty()) {
            return null;
        }
        if (normalized.length() > maxLength) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    field + " must not exceed " + maxLength + " characters");
        }
        return normalized;
    }
}
