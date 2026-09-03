package com.action.camera.social.dto;

import com.action.camera.admin.dto.ModerationView;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

public class MomentDto {

    private final Long momentId;
    private final Long authorId;
    private final String authorRole;
    private final String title;
    private final String content;
    private final String imageData;
    private final List<String> imageDataList;
    private final List<String> mentions;
    private final int likeCount;
    private final boolean likedByCurrentUser;
    private final int favoriteCount;
    private final boolean favoritedByCurrentUser;
    private final LocalDateTime createdAt;
    private final LocalDateTime updatedAt;
    private final LocalDateTime deletedAt;
    private final String status;
    private final ModerationView moderation;

    public MomentDto(Long momentId, Long authorId, String authorRole, String title, String content,
                     String imageData, List<String> mentions, int likeCount,
                     boolean likedByCurrentUser, int favoriteCount,
                     boolean favoritedByCurrentUser, LocalDateTime createdAt) {
        this(momentId, authorId, authorRole, title, content, imageData, Collections.emptyList(), mentions,
                likeCount, likedByCurrentUser, favoriteCount, favoritedByCurrentUser,
                createdAt, null, null, null, null);
    }

    public MomentDto(Long momentId, Long authorId, String authorRole, String title, String content,
                     String imageData, List<String> imageDataList, List<String> mentions, int likeCount,
                     boolean likedByCurrentUser, int favoriteCount,
                     boolean favoritedByCurrentUser, LocalDateTime createdAt,
                     LocalDateTime updatedAt, LocalDateTime deletedAt, String status) {
        this(momentId, authorId, authorRole, title, content, imageData, imageDataList, mentions,
                likeCount, likedByCurrentUser, favoriteCount, favoritedByCurrentUser,
                createdAt, updatedAt, deletedAt, status, null);
    }

    public MomentDto(Long momentId, Long authorId, String authorRole, String title, String content,
                     String imageData, List<String> imageDataList, List<String> mentions, int likeCount,
                     boolean likedByCurrentUser, int favoriteCount,
                     boolean favoritedByCurrentUser, LocalDateTime createdAt,
                     LocalDateTime updatedAt, LocalDateTime deletedAt, String status,
                     ModerationView moderation) {
        this.momentId = momentId;
        this.authorId = authorId;
        this.authorRole = authorRole;
        this.title = title;
        this.content = content;
        this.imageData = imageData;
        this.imageDataList = imageDataList == null ? Collections.emptyList() : List.copyOf(imageDataList);
        this.mentions = mentions == null ? Collections.emptyList() : List.copyOf(mentions);
        this.likeCount = likeCount;
        this.likedByCurrentUser = likedByCurrentUser;
        this.favoriteCount = favoriteCount;
        this.favoritedByCurrentUser = favoritedByCurrentUser;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.deletedAt = deletedAt;
        this.status = status;
        this.moderation = moderation;
    }

    public Long getMomentId() {
        return momentId;
    }

    public Long getAuthorId() {
        return authorId;
    }

    public String getAuthorRole() {
        return authorRole;
    }

    public String getTitle() {
        return title;
    }

    public String getContent() {
        return content;
    }

    public String getImageData() {
        return imageData;
    }

    public List<String> getImageDataList() {
        return imageDataList;
    }

    public List<String> getMentions() {
        return mentions;
    }

    public int getLikeCount() {
        return likeCount;
    }

    public boolean isLikedByCurrentUser() {
        return likedByCurrentUser;
    }

    public int getFavoriteCount() {
        return favoriteCount;
    }

    public boolean isFavoritedByCurrentUser() {
        return favoritedByCurrentUser;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public LocalDateTime getDeletedAt() {
        return deletedAt;
    }

    public String getStatus() {
        return status;
    }

    public ModerationView getModeration() {
        return moderation;
    }
}
