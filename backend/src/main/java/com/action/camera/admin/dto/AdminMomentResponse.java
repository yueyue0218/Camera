package com.action.camera.admin.dto;

import com.action.camera.social.domain.MomentPost;

import java.time.LocalDateTime;
import java.util.List;

public record AdminMomentResponse(
        Long momentId,
        Long authorId,
        String authorRole,
        String title,
        String content,
        String imageData,
        List<String> imageDataList,
        List<String> mentions,
        int likeCount,
        int favoriteCount,
        String businessStatus,
        String moderationStatus,
        Long moderatedBy,
        LocalDateTime moderatedAt,
        String moderationReason,
        long pendingReportCount,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        LocalDateTime deletedAt
) {

    public static AdminMomentResponse from(MomentPost moment, long pendingReportCount) {
        return new AdminMomentResponse(
                moment.getId(),
                moment.getAuthorId(),
                moment.getAuthorRole(),
                moment.getTitle(),
                moment.getContent(),
                moment.getImageData(),
                moment.getImageDataList(),
                moment.getMentions(),
                moment.getLikeCount(),
                moment.getFavoriteCount(),
                moment.getStatus().name(),
                moment.getModerationStatus().name(),
                moment.getModeratedBy(),
                moment.getModeratedAt(),
                moment.getModerationReason(),
                pendingReportCount,
                moment.getCreatedAt(),
                moment.getUpdatedAt(),
                moment.getDeletedAt());
    }
}
