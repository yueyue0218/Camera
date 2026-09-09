package com.action.camera.auth.dto;

import com.action.camera.auth.service.SessionAuthenticationResult;
import com.action.camera.dto.LoginResponse;

public record NativeSessionResponse(
        String accessToken,
        String refreshToken,
        Long userId,
        String nickname,
        String role,
        boolean adminCapable,
        boolean newUser
) {
    public static NativeSessionResponse from(SessionAuthenticationResult result) {
        LoginResponse login = result.response();
        return new NativeSessionResponse(
                login.getToken(), result.refreshToken(), login.getUserId(), login.getNickname(),
                login.getRole(), login.isAdminCapable(), login.isNewUser());
    }
}
