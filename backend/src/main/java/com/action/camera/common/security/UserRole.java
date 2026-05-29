package com.action.camera.common.security;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;

public enum UserRole {
    CUSTOMER,
    PROVIDER,
    ADMIN;

    public static UserRole parse(String value, UserRole defaultRole) {
        if (value == null || value.isBlank()) {
            return defaultRole;
        }
        try {
            return UserRole.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "未知用户角色: " + value);
        }
    }
}
