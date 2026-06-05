package com.action.camera.review.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Entity
@Table(
        name = "reviews",
        uniqueConstraints = @UniqueConstraint(name = "uk_reviews_order_direction", columnNames = {"order_id", "direction"})
)
public class Review {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long orderId;

    private Long reviewerId;

    private Long targetUserId;

    private String direction;

    private Integer rating;

    private String content;

    private Boolean isVisible;

    private String replyContent;

    private LocalDateTime createdAt;

    private LocalDateTime replyTime;
}
