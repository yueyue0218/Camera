package com.action.camera.common.security;

public class CurrentUser {

    private final Long userId;
    private final UserRole role;
    private final boolean admin;

    public CurrentUser(Long userId, UserRole role) {
        this(userId, role, role == UserRole.ADMIN);
    }

    public CurrentUser(Long userId, UserRole role, boolean admin) {
        this.userId = userId;
        this.role = role;
        this.admin = admin || role == UserRole.ADMIN;
    }

    public Long getUserId() {
        return userId;
    }

    public UserRole getRole() {
        return role;
    }

    public boolean isAdmin() {
        return admin;
    }

    public boolean isCustomer() {
        return role == UserRole.CUSTOMER;
    }

    public boolean isProvider() {
        return role == UserRole.PROVIDER;
    }
}
