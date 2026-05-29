package com.action.camera.order.entity;

import com.action.camera.order.enums.OrderStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Audit log for every successful order status change.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "order_status_logs")
public class OrderStatusLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", length = 40)
    private OrderStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", nullable = false, length = 40)
    private OrderStatus toStatus;

    @Column(name = "operator_id")
    private Long operatorId;

    @Column(name = "operator_role", length = 20)
    private String operatorRole;

    @Column(name = "remark")
    private String remark;

    @Transient
    private String reason;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public String getReason() {
        return remark;
    }

    public void setReason(String reason) {
        this.reason = reason;
        this.remark = reason;
    }

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if ((remark == null || remark.isBlank()) && reason != null) {
            remark = reason;
        }
    }
}
