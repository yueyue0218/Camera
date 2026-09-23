package com.action.camera.image;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;

import java.util.Arrays;

public enum ImageVariant {
    THUMBNAIL("thumbnail", 640, 0.78f),
    MEDIUM("medium", 1600, 0.84f),
    ORIGINAL("original", 0, 1.0f);

    private final String pathValue;
    private final int maxLongEdge;
    private final float quality;

    ImageVariant(String pathValue, int maxLongEdge, float quality) {
        this.pathValue = pathValue;
        this.maxLongEdge = maxLongEdge;
        this.quality = quality;
    }

    public String pathValue() {
        return pathValue;
    }

    public int maxLongEdge() {
        return maxLongEdge;
    }

    public float quality() {
        return quality;
    }

    public static ImageVariant parse(String value) {
        return Arrays.stream(values())
                .filter(item -> item.pathValue.equalsIgnoreCase(value))
                .findFirst()
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.VALIDATION_ERROR, "Unsupported image variant: " + value));
    }
}
