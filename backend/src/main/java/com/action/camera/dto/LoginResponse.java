package com.action.camera.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LoginResponse {
    private String token;
    private Long userId;
    private String nickname;
    private String role;
    private boolean adminCapable;

    public LoginResponse(String token, Long userId, String nickname, String role) {
        this(token, userId, nickname, role, false);
    }

    public LoginResponse(String token, Long userId, String nickname, String role, boolean adminCapable) {
        this.token = token;
        this.userId = userId;
        this.nickname = nickname;
        this.role = role;
        this.adminCapable = adminCapable;
    }
}
