package com.action.camera.auth.service;

import com.action.camera.dto.LoginResponse;

import java.time.Duration;

public record SessionAuthenticationResult(
        LoginResponse response,
        String refreshToken,
        String refreshCookieName,
        Duration refreshTtl
) {
}
