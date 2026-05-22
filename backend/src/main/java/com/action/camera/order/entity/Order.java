package com.action.camera.order.entity;

import com.action.camera.order.converter.CentToYuanConverter;
import com.action.camera.order.enums.EscrowStatus;
import com.action.camera.order.enums.OrderStatus;
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
 * Appointment photography service order generated from a confirmed quote.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "orders")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_no", nullable = false, length = 40)
    private String orderNo;

    @Column(name = "quote_id", nullable = false)
    private Long quoteId;

    @Column(name = "conversation_id", nullable = false)
    private Long conversationId;

    @Column(name = "customer_id", nullable = false)
    private Long customerId;

    @Column(name = "provider_user_id", nullable = false)
    private Long providerUserId;

    @Column(name = "demand_id")
    private Long demandId;

    @Column(name = "service_package_id")
    private Long servicePackageId;

    @Column(name = "shooting_plan_id")
    private Long shootingPlanId;

    @Transient
    private String sourceType;

    @Transient
    private Long sourceId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 40)
    private OrderStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "escrow_status", nullable = false, length = 30)
    private EscrowStatus escrowStatus;

    @Column(name = "settlement_status", nullable = false, length = 30)
    private String settlementStatus = "NOT_SETTLED";

    @Column(name = "refund_status", nullable = false, length = 30)
    private String refundStatus = "NONE";

    @Column(name = "total_amount", nullable = false, precision = 10, scale = 2)
    @Convert(converter = CentToYuanConverter.class)
    private Long totalAmountCent;

    @Column(name = "platform_fee", nullable = false, precision = 10, scale = 2)
    @Convert(converter = CentToYuanConverter.class)
    private Long platformFeeCent = 0L;

    @Column(name = "provider_income", nullable = false, precision = 10, scale = 2)
    @Convert(converter = CentToYuanConverter.class)
    private Long providerIncomeCent = 0L;

    @Column(name = "shoot_start_time", nullable = false)
    private LocalDateTime shootStartTime;

    @Column(name = "shoot_end_time", nullable = false)
    private LocalDateTime shootEndTime;

    @Column(name = "shoot_location", nullable = false)
    private String shootLocation;

    @Column(name = "delivery_deadline", nullable = false)
    private LocalDateTime deliveryDeadline;

    @Column(name = "photo_usage_scope", nullable = false, length = 60)
    private String photoUsageScope = "PERSONAL_ONLY";

    @Column(name = "quote_snapshot_json", nullable = false, columnDefinition = "json")
    private String quoteSnapshotJson;

    @Column(name = "safety_notice_confirmed", nullable = false)
    private Boolean safetyNoticeConfirmed = false;

    @Column(name = "contract_terms")
    private String contractTerms;

    @Column(name = "auto_confirm_time")
    private LocalDateTime autoConfirmTime;

    @Column(name = "complete_time")
    private LocalDateTime completeTime;

    @Column(name = "cancel_time")
    private LocalDateTime cancelTime;

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
        if (status == null) {
            status = OrderStatus.PENDING_PAYMENT;
        }
        if (escrowStatus == null) {
            escrowStatus = EscrowStatus.NOT_PAID;
        }
        if (settlementStatus == null || settlementStatus.isBlank()) {
            settlementStatus = "NOT_SETTLED";
        }
        if (refundStatus == null || refundStatus.isBlank()) {
            refundStatus = "NONE";
        }
        if (platformFeeCent == null) {
            platformFeeCent = 0L;
        }
        if (providerIncomeCent == null) {
            providerIncomeCent = 0L;
        }
        if (photoUsageScope == null || photoUsageScope.isBlank()) {
            photoUsageScope = "PERSONAL_ONLY";
        }
        if (quoteSnapshotJson == null || quoteSnapshotJson.isBlank()) {
            quoteSnapshotJson = "{}";
        }
        if (safetyNoticeConfirmed == null) {
            safetyNoticeConfirmed = false;
        }
    }
}
