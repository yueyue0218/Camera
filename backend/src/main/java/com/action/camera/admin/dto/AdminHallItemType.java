package com.action.camera.admin.dto;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;

import java.util.Locale;

public enum AdminHallItemType {
    ALL,
    DEMAND,
    SERVICE_PACKAGE;

    public static AdminHallItemType parse(String value) {
        String normalized = value == null || value.isBlank()
                ? ALL.name()
                : value.trim().toUpperCase(Locale.ROOT);
        try {
            return valueOf(normalized);
        } catch (IllegalArgumentException exception) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unsupported hall item type: " + value);
        }
    }

    public void requireConcrete() {
        if (this == ALL) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Hall item type must be DEMAND or SERVICE_PACKAGE");
        }
    }
}
