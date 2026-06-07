package com.action.camera.review.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "review_complaints")
public class ReviewComplaint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long reviewId;

    private Long orderId;

    private Long complainantId;

    private Long respondentId;

    private String reason;

    private String evidenceFileIds;

    private String status;

    private String arbitrationResult;

    private String arbitrationComment;

    private Long handledBy;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private LocalDateTime handledAt;
}
