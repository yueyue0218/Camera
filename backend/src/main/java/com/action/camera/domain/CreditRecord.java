package com.action.camera.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "credit_records")
@Getter
@Setter
public class CreditRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "related_order_id")
    private Long relatedOrderId;

    @Column(name = "event_type", nullable = false, length = 40)
    private String eventType;

    @Column(name = "score_change", nullable = false)
    private Integer scoreChange;

    @Column(name = "score_after", nullable = false, precision = 5, scale = 2)
    private BigDecimal scoreAfter;

    @Column(name = "reason", length = 1000)
    private String reason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }
}
