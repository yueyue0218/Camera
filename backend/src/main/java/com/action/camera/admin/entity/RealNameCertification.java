package com.action.camera.admin.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "real_name_certifications")
public class RealNameCertification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "real_name", nullable = false, length = 64)
    private String realNameMasked;

    @Column(name = "id_card_number", nullable = false, length = 32)
    private String idCardNoMasked;

    @Transient
    private byte[] idCardNoCipher;

    @Transient
    private String idCardNoHash;

    @Column(name = "id_card_front_file_id", nullable = false)
    private Long idCardFrontFileId;

    @Column(name = "id_card_back_file_id", nullable = false)
    private Long idCardBackFileId;

    @Transient
    private String faceVerifyResult;

    @Column(name = "status", nullable = false, length = 30)
    private String status = "PENDING_REVIEW";

    @Column(name = "reject_reason", length = 255)
    private String rejectReason;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime appliedAt;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "reviewer_admin_id")
    private Long reviewerId;

    @PrePersist
    void prePersist() {
        if (appliedAt == null) {
            appliedAt = LocalDateTime.now();
        }
        if (status == null || status.isBlank()) {
            status = "PENDING_REVIEW";
        }
    }
}
