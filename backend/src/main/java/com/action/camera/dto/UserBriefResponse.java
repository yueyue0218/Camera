package com.action.camera.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
public class UserBriefResponse {
    private Long userId;
    private String nickname;
    private Long avatarFileId;  // null 表示未设头像
}