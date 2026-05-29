package com.action.camera.schedule.entity;

import com.action.camera.schedule.enums.ScheduleStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "schedules")
public class Schedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "provider_user_id", nullable = false)
    private Long providerUserId;

    @Column(name = "schedule_date", nullable = false)
    private LocalDate scheduleDate;

    @Column(name = "time_slot", length = 80)
    private String timeSlot;

    @Column(name = "city_code", nullable = false, length = 40)
    private String cityCode;

    @Column(name = "location_hint")
    private String locationHint;

    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalDateTime endTime;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private ScheduleStatus status = ScheduleStatus.AVAILABLE;

    @Column(name = "locked_by_order_id")
    private Long lockedByOrderId;

    @Column(name = "lock_expire_time")
    private LocalDateTime lockExpireTime;

    @Column(name = "private_remark")
    private String privateRemark;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        fillDefaults();
    }

    @PreUpdate
    void preUpdate() {
        fillDefaults();
    }

    private void fillDefaults() {
        if (status == null) {
            status = ScheduleStatus.AVAILABLE;
        }
        if (scheduleDate == null && startTime != null) {
            scheduleDate = startTime.toLocalDate();
        }
    }
}
