package com.action.camera.delivery.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "deliveries")
public class Delivery {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long orderId;

    private Integer deliveryRound;

    private Boolean isLatest;

    private Integer originalCount;

    private Integer refinedCount;

    private LocalDateTime deadline;

    private String status;

    private String remark;

    private LocalDateTime uploadTime;

    private LocalDateTime confirmTime;

    private LocalDateTime autoConfirmDeadline;
}
