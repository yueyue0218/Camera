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
        uniqueConstraints = @UniqueConstraint(
                name = "uk_service_package_interest_user_package",
                columnNames = {"user_id", "service_package_id"}),
        indexes = {
                @Index(name = "idx_service_package_interest_user", columnList = "user_id,created_at"),
                @Index(name = "idx_service_package_interest_package", columnList = "service_package_id")
        })
public class ServicePackageInterest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "service_package_id", nullable = false)
    private Long servicePackageId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
