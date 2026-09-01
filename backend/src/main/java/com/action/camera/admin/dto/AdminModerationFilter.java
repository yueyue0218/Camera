package com.action.camera.admin.dto;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;

import java.util.Locale;

public enum AdminModerationFilter {
    ALL,
    VISIBLE,
    HIDDEN,
    REPORTED;

    public static AdminModerationFilter parse(String value) {
        String normalized = value == null || value.isBlank()
                ? ALL.name()
                : value.trim().toUpperCase(Locale.ROOT);
        try {
            return valueOf(normalized);
        } catch (IllegalArgumentException exception) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unsupported moderation filter: " + value);
        }
    }
}
