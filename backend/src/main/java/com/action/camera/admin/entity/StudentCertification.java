package com.action.camera.admin.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "student_certifications")
public class StudentCertification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "real_name_masked", nullable = false, length = 64)
    private String realNameMasked;

    @Column(name = "student_no_cipher")
    private byte[] studentNoCipher;

    @Column(name = "student_no_hash", length = 64)
    private String studentNoHash;

    @Column(name = "university", nullable = false, length = 128)
    private String university;

    @Column(name = "student_card_file_id", nullable = false)
    private Long studentCardFileId;

    @Column(name = "status", nullable = false, length = 30)
    private String status = "PENDING_REVIEW";

    @Column(name = "reject_reason", length = 255)
    private String rejectReason;

    @Column(name = "applied_at", nullable = false)
    private LocalDateTime appliedAt;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "reviewer_id")
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
