package com.action.camera.social.domain;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public class MomentPost {

    private final Long id;
    private final Long authorId;
    private final String authorRole;
    private final String title;
    private final String content;
    private final String imageData;
    private final List<String> mentions;
    private final LocalDateTime createdAt;
    private final Set<Long> likedUserIds = new LinkedHashSet<>();
    private final Set<Long> favoritedUserIds = new LinkedHashSet<>();

    public MomentPost(Long id, Long authorId, String authorRole, String title, String content,
                      String imageData, List<String> mentions, LocalDateTime createdAt) {
        this.id = id;
        this.authorId = authorId;
        this.authorRole = authorRole;
        this.title = title;
        this.content = content;
        this.imageData = imageData;
        this.mentions = mentions == null
                ? Collections.emptyList()
                : Collections.unmodifiableList(new ArrayList<>(mentions));
        this.createdAt = createdAt;
    }

    public void toggleLike(Long userId) {
        if (likedUserIds.contains(userId)) {
            likedUserIds.remove(userId);
        } else {
            likedUserIds.add(userId);
        }
    }

    public void toggleFavorite(Long userId) {
        if (favoritedUserIds.contains(userId)) {
            favoritedUserIds.remove(userId);
        } else {
            favoritedUserIds.add(userId);
        }
    }

    public boolean likedBy(Long userId) {
        return likedUserIds.contains(userId);
    }

    public boolean favoritedBy(Long userId) {
        return favoritedUserIds.contains(userId);
    }

    public Long getId() {
        return id;
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

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public int getLikeCount() {
        return likedUserIds.size();
    }

    public int getFavoriteCount() {
        return favoritedUserIds.size();
    }
}
