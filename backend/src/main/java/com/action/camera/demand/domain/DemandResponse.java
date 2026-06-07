package com.action.camera.demand.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
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
@Table(name = "demand_responses",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_demand_provider_response",
                columnNames = {"demand_id", "provider_user_id"}),
        indexes = {
                @Index(name = "idx_response_provider_status", columnList = "provider_user_id,status,response_time"),
                @Index(name = "idx_response_demand_status", columnList = "demand_id,status,response_time")
        })
public class DemandResponse {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "demand_id", nullable = false)
    private Long demandId;

    @Column(name = "provider_user_id", nullable = false)
    private Long providerId;

    @Column(name = "provider_profile_id", nullable = false)
    private Long providerProfileId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(name = "expected_price_cent")
    private Integer expectedPriceCent;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private DemandResponseStatus status = DemandResponseStatus.PENDING_CUSTOMER_ACCEPT;

    @Column(name = "reject_reason")
    private String rejectReason;

    @Column(name = "response_time", nullable = false)
    private LocalDateTime responseTime;

    public DemandResponse(Long demandId,
                          Long providerId,
                          Long providerProfileId,
                          String message,
                          Integer expectedPriceCent,
                          LocalDateTime responseTime) {
        this.demandId = demandId;
        this.providerId = providerId;
        this.providerProfileId = providerProfileId;
        this.message = message;
        this.expectedPriceCent = expectedPriceCent;
        this.status = DemandResponseStatus.PENDING_CUSTOMER_ACCEPT;
        this.responseTime = responseTime;
    }

    public void accept() {
        this.status = DemandResponseStatus.ACCEPTED;
        this.rejectReason = null;
    }

    public void reject(String reason) {
        this.status = DemandResponseStatus.REJECTED;
        this.rejectReason = reason;
    }

    @PrePersist
    void prePersist() {
        if (status == null) {
            status = DemandResponseStatus.PENDING_CUSTOMER_ACCEPT;
        }
        if (responseTime == null) {
            responseTime = LocalDateTime.now();
        }
    }
}
