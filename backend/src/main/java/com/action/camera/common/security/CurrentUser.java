package com.action.camera.common.security;

public class CurrentUser {

    private final Long userId;
    private final UserRole role;

    public CurrentUser(Long userId, UserRole role) {
        this.userId = userId;
        this.role = role;
    }

    public Long getUserId() {
        return userId;
    }

    public UserRole getRole() {
        return role;
    }

    public boolean isAdmin() {
        return role == UserRole.ADMIN;
    }

    public boolean isCustomer() {
        return role == UserRole.CUSTOMER;
    }

    public boolean isProvider() {
        return role == UserRole.PROVIDER;
    }
}
