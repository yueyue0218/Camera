package com.action.camera.social.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(
        name = "user_follows",
        uniqueConstraints = @UniqueConstraint(name = "uk_user_follows_triple", columnNames = {"follower_id", "following_user_id", "target_role"})
)
public class UserFollow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "follower_id", nullable = false)
    private Long followerId;

    @Column(name = "following_user_id", nullable = false)
    private Long followingUserId;

    @Column(name = "target_role", nullable = false, length = 20)
    private String targetRole = "CUSTOMER";

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public UserFollow(Long followerId, Long followingUserId, String targetRole) {
        this.followerId = followerId;
        this.followingUserId = followingUserId;
        this.targetRole = targetRole != null ? targetRole : "CUSTOMER";
    }

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (targetRole == null) {
            targetRole = "CUSTOMER";
        }
    }
}
