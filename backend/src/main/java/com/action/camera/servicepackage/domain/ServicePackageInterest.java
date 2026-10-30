package com.action.camera.servicepackage.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "service_package_interests",
        uniqueConstraints = {@UniqueConstraint(
                name = "uk_service_package_interest_user_package",
                columnNames = {"user_id", "service_package_id"}),
                @UniqueConstraint(name = "uk_interest_user_demand", columnNames = {"user_id", "demand_id"})},
        indexes = {
                @Index(name = "idx_service_package_interest_user", columnList = "user_id,created_at"),
                @Index(name = "idx_interest_user_target_time", columnList = "user_id,target_type,created_at,id"),
                @Index(name = "idx_service_package_interest_package", columnList = "service_package_id")
        })
public class ServicePackageInterest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "service_package_id")
    private Long servicePackageId;

    /** Both roles use the same intention business; the target distinguishes the lists. */
    @Column(name = "target_type", nullable = false, length = 20)
    private String targetType = "SERVICE_PACKAGE";

    @Column(name = "demand_id", unique = false)
    private Long demandId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
