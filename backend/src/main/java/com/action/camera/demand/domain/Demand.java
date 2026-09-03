package com.action.camera.demand.domain;

import com.action.camera.admin.domain.ModerationStatus;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
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
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "demands", indexes = {
        @Index(name = "idx_demands_hall", columnList = "status,city_code,scene,expected_date"),
        @Index(name = "idx_demands_budget_cent", columnList = "budget_min_cent,budget_max_cent"),
        @Index(name = "idx_demands_customer_status", columnList = "customer_id,status,created_at"),
        @Index(name = "idx_demands_moderation_public", columnList = "moderation_status,status,created_at")
})
public class Demand {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "customer_id", nullable = false)
    private Long customerId;

    @Column(nullable = false, length = 80)
    private String scene;

    @Convert(converter = DemandStringListJsonConverter.class)
    @Column(name = "style_tags", nullable = false, columnDefinition = "TEXT")
    private List<String> styleTags = List.of();

    @Column(name = "expected_date")
    private LocalDate expectedDate;

    @Column(name = "time_slot", length = 80)
    private String timeSlot;

    @Column(name = "time_description", nullable = false, columnDefinition = "TEXT")
    private String timeDescription;

    @Convert(converter = DemandStringListJsonConverter.class)
    @Column(name = "time_tags", nullable = false, columnDefinition = "TEXT")
    private List<String> timeTags = List.of();

    @Column(name = "city_code", nullable = false, length = 40)
    private String cityCode;

    @Column(nullable = false)
    private String location;

    @Column(name = "budget_min_cent")
    private Integer budgetMinCent;

    @Column(name = "budget_max_cent")
    private Integer budgetMaxCent;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Convert(converter = DemandLongListJsonConverter.class)
    @Column(name = "reference_file_ids", nullable = false, columnDefinition = "TEXT")
    private List<Long> referenceFileIds = List.of();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private DemandStatus status = DemandStatus.OPEN;

    @Column(name = "response_count", nullable = false)
    private int responseCount;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "expire_time")
    private LocalDateTime expireTime;

    @Column(name = "hidden_by_customer", nullable = false)
    private Boolean hiddenByCustomer = false;

    @Column(name = "hidden_at")
    private LocalDateTime hiddenAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "moderation_status", nullable = false, length = 20)
    private ModerationStatus moderationStatus = ModerationStatus.VISIBLE;

    @Column(name = "moderated_by")
    private Long moderatedBy;

    @Column(name = "moderated_at")
    private LocalDateTime moderatedAt;

    @Column(name = "moderation_reason", length = 500)
    private String moderationReason;

    public Demand(Long customerId,
                  String scene,
                  List<String> styleTags,
                  LocalDate expectedDate,
                  String timeSlot,
                  String timeDescription,
                  List<String> timeTags,
                  String cityCode,
                  String location,
                  Integer budgetMinCent,
                  Integer budgetMaxCent,
                  String description,
                  List<Long> referenceFileIds,
                  LocalDateTime createdAt,
                  LocalDateTime expireTime) {
        this.customerId = customerId;
        this.scene = scene;
        this.styleTags = copyList(styleTags);
        this.expectedDate = expectedDate;
        this.timeSlot = timeSlot;
        this.timeDescription = timeDescription;
        this.timeTags = copyList(timeTags);
        this.cityCode = cityCode;
        this.location = location;
        this.budgetMinCent = budgetMinCent;
        this.budgetMaxCent = budgetMaxCent;
        this.description = description;
        this.referenceFileIds = copyList(referenceFileIds);
        this.status = DemandStatus.OPEN;
        this.responseCount = 0;
        this.createdAt = createdAt;
        this.updatedAt = createdAt;
        this.expireTime = expireTime;
    }

    private static <T> List<T> copyList(List<T> source) {
        if (source == null) {
            return Collections.emptyList();
        }
        return Collections.unmodifiableList(new ArrayList<>(source));
    }

    public void increaseResponseCount() {
        responseCount++;
        touch();
    }

    public void close() {
        status = DemandStatus.CLOSED;
        touch();
    }

    public void hideForCustomer() {
        hiddenByCustomer = true;
        hiddenAt = LocalDateTime.now();
        touch();
    }

    public void takeDown(Long adminId, String reason, LocalDateTime now) {
        changeModeration(ModerationStatus.VISIBLE, ModerationStatus.HIDDEN, adminId, reason, now);
    }

    public void restore(Long adminId, String reason, LocalDateTime now) {
        changeModeration(ModerationStatus.HIDDEN, ModerationStatus.VISIBLE, adminId, reason, now);
    }

    public boolean isModerationVisible() {
        return ModerationStatus.VISIBLE.equals(moderationStatus);
    }

    private void touch() {
        updatedAt = LocalDateTime.now();
    }

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = createdAt;
        }
        fillDefaults();
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
        fillDefaults();
    }

    private void fillDefaults() {
        if (status == null) {
            status = DemandStatus.OPEN;
        }
        if (styleTags == null) {
            styleTags = List.of();
        }
        if (timeTags == null) {
            timeTags = List.of();
        }
        if (referenceFileIds == null) {
            referenceFileIds = List.of();
        }
        if (hiddenByCustomer == null) {
            hiddenByCustomer = false;
        }
        if (moderationStatus == null) {
            moderationStatus = ModerationStatus.VISIBLE;
        }
    }

    private void changeModeration(ModerationStatus expected,
                                  ModerationStatus target,
                                  Long adminId,
                                  String reason,
                                  LocalDateTime now) {
        ModerationStatus current = moderationStatus == null ? ModerationStatus.VISIBLE : moderationStatus;
        if (!expected.equals(current)) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "Content moderation state has already changed");
        }
        validateModerationInputs(adminId, reason, now);
        moderationStatus = target;
        moderatedBy = adminId;
        moderatedAt = now;
        moderationReason = reason.trim();
    }

    private void validateModerationInputs(Long adminId, String reason, LocalDateTime now) {
        if (adminId == null || adminId <= 0 || now == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Administrator and moderation time are required");
        }
        if (reason == null || reason.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Moderation reason is required");
        }
        if (reason.trim().length() > 500) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Moderation reason is too long");
        }
    }
}
