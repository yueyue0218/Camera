package com.action.camera.review.dto;

public record ReviewComplaintCreateRequest(
        String reason,
        String evidenceFileIds
) {
}
