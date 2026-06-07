package com.action.camera.message.entity;

import com.action.camera.message.enums.QuoteStatus;
import com.action.camera.order.converter.CentToYuanConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Formal service quote sent by the provider after a demand response is accepted.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "quotes")
public class Quote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "quote_no", nullable = false, length = 40)
    private String quoteNo;

    @Column(name = "conversation_id", nullable = false)
    private Long conversationId;

    @Column(name = "provider_user_id", nullable = false)
    private Long providerUserId;

    @Column(name = "customer_id", nullable = false)
    private Long customerId;

    @Column(name = "shooting_plan_id")
    private Long shootingPlanId;

    @Column(name = "source_type", nullable = false, length = 40)
    private String sourceType;

    @Column(name = "source_id")
    private Long sourceId;

    @Column(name = "total_amount", nullable = false, precision = 10, scale = 2)
    @Convert(converter = CentToYuanConverter.class)
    private Long amountCent;

    @Column(name = "shoot_start_time", nullable = false)
    private LocalDateTime shootStartTime;

    @Column(name = "shoot_end_time", nullable = false)
    private LocalDateTime shootEndTime;

    @Column(name = "location", nullable = false)
    private String location;

    @Column(name = "service_content")
    private String serviceContent;

    @Column(name = "original_count", nullable = false)
    private Integer originalCount = 0;

    @Column(name = "refined_count", nullable = false)
    private Integer refinedCount = 0;

    @Column(name = "delivery_deadline", nullable = false)
    private LocalDateTime deliveryDeadline;

    @Column(name = "photo_usage_scope", nullable = false, length = 60)
    private String photoUsageScope = "PERSONAL_ONLY";

    @Column(name = "terms")
    private String terms;

    @Column(name = "contract_terms")
    private String contractTerms;

    @Column(name = "safety_notice_version", length = 40)
    private String safetyNoticeVersion;

    @Column(name = "service_snapshot_json", nullable = false, columnDefinition = "json")
    private String serviceSnapshotJson = "{}";

    @Transient
    private Integer deliveryDays;

    @Transient
    private String remark;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private QuoteStatus status;

    @Column(name = "expire_time", nullable = false)
    private LocalDateTime expireTime;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
        fillDefaults();
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
        fillDefaults();
    }

    private void fillDefaults() {
        if (originalCount == null) {
            originalCount = 0;
        }
        if (refinedCount == null) {
            refinedCount = 0;
        }
        if (photoUsageScope == null || photoUsageScope.isBlank()) {
            photoUsageScope = "PERSONAL_ONLY";
        }
        if (serviceSnapshotJson == null || serviceSnapshotJson.isBlank()) {
            serviceSnapshotJson = "{}";
        }
        if (status == null) {
            status = QuoteStatus.PENDING_CONFIRM;
        }
        if (deliveryDeadline == null && shootEndTime != null && deliveryDays != null) {
            deliveryDeadline = shootEndTime.plusDays(deliveryDays);
        }
    }
}
