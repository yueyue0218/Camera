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
    private String cityCode;
    private String bio;
    private Long avatarFileId;
    private String currentRole;
    private String status;
    private BigDecimal creditScore;
    private LocalDateTime createdAt;
}