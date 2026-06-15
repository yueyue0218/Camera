package com.action.camera.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
public class UserProfileResponse {
    private Long id;
    private String studentNo;
    private String nickname;
    private String school;
    private String gender;
    private Boolean genderVisible;
    private String birthday;
    private Boolean birthdayVisible;
    private String locationDisplay;
    private Boolean locationVisible;
    private String cityCode;
    private String bio;
    private Long avatarFileId;
    private String currentRole;
    private String status;
    private BigDecimal creditScore;
    private LocalDateTime createdAt;
    // Dual-identity fields
    private String customerNickname;
    private Long customerAvatarFileId;
    private String customerBio;
    private String providerNickname;
    private Long providerAvatarFileId;
    private String providerBio;
}