package com.action.camera.auth.dto;

public class SessionLoginResponse {

    private final String token;
    private final String refreshToken;
    private final long expiresIn;
    private final SessionUserDto user;

    public SessionLoginResponse(String token, String refreshToken, long expiresIn, SessionUserDto user) {
        this.token = token;
        this.refreshToken = refreshToken;
        this.expiresIn = expiresIn;
        this.user = user;
    }

    public String getToken() {
        return token;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public long getExpiresIn() {
        return expiresIn;
    }

    public SessionUserDto getUser() {
        return user;
    }
}
