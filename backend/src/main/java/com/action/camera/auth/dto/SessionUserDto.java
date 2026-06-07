package com.action.camera.auth.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class SessionUserDto {

    private final Long userId;
    private final String role;
    private final String mobile;
    private final boolean isNewUser;

    public SessionUserDto(Long userId, String role, String mobile, boolean isNewUser) {
        this.userId = userId;
        this.role = role;
        this.mobile = mobile;
        this.isNewUser = isNewUser;
    }

    public Long getUserId() {
        return userId;
    }

    public String getRole() {
        return role;
    }

    public String getMobile() {
        return mobile;
    }

    @JsonProperty("isNewUser")
    public boolean isNewUser() {
        return isNewUser;
    }
}
