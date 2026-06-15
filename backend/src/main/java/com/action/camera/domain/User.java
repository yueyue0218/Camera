package com.action.camera.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter
@Setter
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "student_no", length = 9, unique = true)
    private String studentNo;

    @Column(name = "password_hash", length = 100)
    private String passwordHash;

    @Column(name = "nickname", nullable = false, length = 64)
    private String nickname;

    @Column(name = "school", length = 128)
    private String school;

    @Column(name = "avatar_file_id")
    private Long avatarFileId;

    @Column(name = "gender", length = 20)
    private String gender;

    @Column(name = "gender_visible")
    private Boolean genderVisible;

    @Column(name = "birthday", length = 20)
    private String birthday;

    @Column(name = "birthday_visible")
    private Boolean birthdayVisible;

    @Column(name = "location_display", length = 100)
    private String locationDisplay;

    @Column(name = "location_visible")
    private Boolean locationVisible;

    @Column(name = "city_code", length = 32)
    private String cityCode;

    @Column(name = "bio", length = 500)
    private String bio;

    @Column(name = "current_role", nullable = false, length = 20)
    private String currentRole = "CUSTOMER";

    @Column(name = "status", nullable = false, length = 20)
    private String status = "ACTIVE";

    @Column(name = "credit_score", precision = 5, scale = 2)
    private BigDecimal creditScore;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
