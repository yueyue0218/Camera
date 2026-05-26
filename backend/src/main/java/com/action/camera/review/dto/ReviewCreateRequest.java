package com.action.camera.review.dto;

public record ReviewCreateRequest(
        Integer rating,
        String content
) {
}
