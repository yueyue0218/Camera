package com.action.camera.photoauthorization.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "photo_authorizations")
public class PhotoAuthorization {

    public static final String STATUS_GRANTED = "GRANTED";
    public static final String USAGE_SCOPE_PORTFOLIO_DISPLAY = "PORTFOLIO_DISPLAY";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(name = "customer_id", nullable = false)
    private Long customerId;

    @Column(name = "provider_user_id", nullable = false)
    private Long providerUserId;

    @Column(name = "photo_usage_scope", nullable = false, length = 60)
    private String photoUsageScope = USAGE_SCOPE_PORTFOLIO_DISPLAY;

    @Column(name = "status", nullable = false, length = 30)
    private String status = STATUS_GRANTED;

    @Column(name = "remark")
    private String remark;

    @Column(name = "authorized_at", nullable = false)
    private LocalDateTime authorizedAt;

    @Column(name = "expire_time")
    private LocalDateTime expireTime;

    @PrePersist
    void prePersist() {
        if (authorizedAt == null) {
            authorizedAt = LocalDateTime.now();
        }
        if (photoUsageScope == null || photoUsageScope.isBlank()) {
            photoUsageScope = USAGE_SCOPE_PORTFOLIO_DISPLAY;
        }
        if (status == null || status.isBlank()) {
            status = STATUS_GRANTED;
        }
    }
}
