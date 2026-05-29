package com.action.camera.social.dto;

import java.time.LocalDateTime;
import java.util.List;

public class MomentDto {

    private final Long momentId;
    private final Long authorId;
    private final String authorRole;
    private final String title;
    private final String content;
    private final String imageData;
    private final List<String> mentions;
    private final int likeCount;
    private final boolean likedByCurrentUser;
    private final int favoriteCount;
    private final boolean favoritedByCurrentUser;
    private final LocalDateTime createdAt;

    public MomentDto(Long momentId, Long authorId, String authorRole, String title, String content,
                     String imageData, List<String> mentions, int likeCount,
                     boolean likedByCurrentUser, int favoriteCount,
                     boolean favoritedByCurrentUser, LocalDateTime createdAt) {
        this.momentId = momentId;
        this.authorId = authorId;
        this.authorRole = authorRole;
        this.title = title;
        this.content = content;
        this.imageData = imageData;
        this.mentions = mentions;
        this.likeCount = likeCount;
        this.likedByCurrentUser = likedByCurrentUser;
        this.favoriteCount = favoriteCount;
        this.favoritedByCurrentUser = favoritedByCurrentUser;
        this.createdAt = createdAt;
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
}
