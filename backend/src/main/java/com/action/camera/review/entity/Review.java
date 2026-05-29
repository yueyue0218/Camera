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
@Table(name = "reviews")
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
