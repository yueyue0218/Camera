package com.action.camera.credit.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "credit_records")
public class CreditRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;

    private Long relatedOrderId;

    private String eventType;

    private Integer scoreChange;

    private BigDecimal scoreAfter;

    private String reason;

    private LocalDateTime createdAt;
}
