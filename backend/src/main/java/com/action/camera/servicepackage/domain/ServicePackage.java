package com.action.camera.servicepackage.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "service_packages", indexes = {
        @Index(name = "idx_service_package_status", columnList = "status"),
        @Index(name = "idx_service_package_provider", columnList = "provider_id,status"),
        @Index(name = "idx_service_package_hall", columnList = "status,city_code,scene,base_price_cent")
})
public class ServicePackage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "provider_id", nullable = false)
    private Long providerId;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(name = "city_code", nullable = false, length = 40)
    private String cityCode;

    @Column(name = "service_area", length = 120)
    private String serviceArea;

    @Column(nullable = false, length = 80)
    private String scene;

    @Convert(converter = StringListJsonConverter.class)
    @Column(name = "style_tags", columnDefinition = "TEXT")
    private List<String> styleTags = List.of();

    @Column(name = "base_price_cent", nullable = false)
    private Long basePriceCent;

    @Column(name = "duration_minutes", nullable = false)
    private Integer durationMinutes;

    @Column(name = "original_count", nullable = false)
    private Integer originalCount;

    @Column(name = "refined_count", nullable = false)
    private Integer refinedCount;

    @Column(name = "delivery_days", nullable = false)
    private Integer deliveryDays;

    @Convert(converter = LocalDateListJsonConverter.class)
    @Column(name = "available_dates", columnDefinition = "TEXT")
    private List<LocalDate> availableDates = List.of();

    @Convert(converter = LongListJsonConverter.class)
    @Column(name = "portfolio_ids", columnDefinition = "TEXT")
    private List<Long> portfolioIds = List.of();

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ServicePackageStatus status = ServicePackageStatus.ONLINE;

    @Column(name = "is_available", nullable = false)
    private Boolean isAvailable = true;

    @Column(name = "temporary_schedule_hold_id")
    private Long temporaryScheduleHoldId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public void markReserved(Long scheduleHoldId) {
        this.isAvailable = false;
        this.temporaryScheduleHoldId = scheduleHoldId;
        this.updatedAt = LocalDateTime.now();
    }

    public void markOffline() {
        this.status = ServicePackageStatus.OFFLINE;
        this.isAvailable = false;
        this.updatedAt = LocalDateTime.now();
    }

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
        if (status == null) {
            status = ServicePackageStatus.ONLINE;
        }
        if (isAvailable == null) {
            isAvailable = true;
        }
        if (styleTags == null) {
            styleTags = List.of();
        }
        if (availableDates == null) {
            availableDates = List.of();
        }
        if (portfolioIds == null) {
            portfolioIds = List.of();
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
