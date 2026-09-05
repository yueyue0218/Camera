package com.action.camera.social.domain;

import com.action.camera.admin.domain.ModerationStatus;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "moment_posts", indexes = {
        @Index(name = "idx_moment_posts_moderation_public", columnList = "moderation_status,status,created_at")
})
public class MomentPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "author_id", nullable = false)
    private Long authorId;

    @Column(name = "author_role", nullable = false, length = 20)
    private String authorRole;

    @Column(name = "title", length = 50)
    private String title;

    @Column(name = "content", length = 1000)
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private MomentStatus status = MomentStatus.PUBLISHED;

    @OneToMany(mappedBy = "moment", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC, id ASC")
    private List<MomentImage> images = new ArrayList<>();

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "moment_mentions", joinColumns = @JoinColumn(name = "moment_id"))
    @Column(name = "mention", length = 100)
    @OrderColumn(name = "sort_order")
    private List<String> mentions = new ArrayList<>();

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "moment_likes", joinColumns = @JoinColumn(name = "moment_id"))
    @Column(name = "user_id", nullable = false)
    private Set<Long> likedUserIds = new LinkedHashSet<>();

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "moment_favorites", joinColumns = @JoinColumn(name = "moment_id"))
    @Column(name = "user_id", nullable = false)
    private Set<Long> favoritedUserIds = new LinkedHashSet<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "moderation_status", nullable = false, length = 20)
    private ModerationStatus moderationStatus = ModerationStatus.VISIBLE;

    @Column(name = "moderated_by")
    private Long moderatedBy;

    @Column(name = "moderated_at")
    private LocalDateTime moderatedAt;

    @Column(name = "moderation_reason", length = 500)
    private String moderationReason;

    public MomentPost(Long authorId, String authorRole, String title, String content,
                      List<String> mentions, List<String> imageDataList) {
        this.authorId = authorId;
        this.authorRole = authorRole;
        this.title = title;
        this.content = content;
        replaceMentions(mentions);
        replaceImages(imageDataList);
    }

    public MomentPost(Long id, Long authorId, String authorRole, String title, String content,
                      String imageData, List<String> mentions, LocalDateTime createdAt) {
        this.id = id;
        this.authorId = authorId;
        this.authorRole = authorRole;
        this.title = title;
        this.content = content;
        replaceMentions(mentions);
        replaceImages(imageData == null ? Collections.emptyList() : List.of(imageData));
        this.createdAt = createdAt;
        this.updatedAt = createdAt;
    }

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
        if (status == null) {
            status = MomentStatus.PUBLISHED;
        }
        if (moderationStatus == null) {
            moderationStatus = ModerationStatus.VISIBLE;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = MomentStatus.PUBLISHED;
        }
        if (moderationStatus == null) {
            moderationStatus = ModerationStatus.VISIBLE;
        }
    }

    public void replaceMentions(List<String> sourceMentions) {
        mentions.clear();
        if (sourceMentions == null) {
            return;
        }
        for (String mention : sourceMentions) {
            if (mention == null) {
                continue;
            }
            String normalized = mention.trim();
            if (!normalized.isBlank() && !mentions.contains(normalized)) {
                mentions.add(normalized);
            }
        }
    }

    public void replaceImages(List<String> sourceImages) {
        images.clear();
        if (sourceImages == null) {
            return;
        }
        int sortOrder = 0;
        for (String imageData : sourceImages) {
            if (imageData == null) {
                continue;
            }
            String normalized = imageData.trim();
            if (normalized.isBlank()) {
                continue;
            }
            images.add(new MomentImage(this, normalized, sortOrder, sortOrder == 0));
            sortOrder++;
        }
    }

    public void updateDraft(String title, String content, List<String> mentions, List<String> imageDataList) {
        this.title = title;
        this.content = content;
        if (mentions != null) {
            replaceMentions(mentions);
        }
        if (imageDataList != null) {
            replaceImages(imageDataList);
        }
    }

    public void markDeleted() {
        status = MomentStatus.DELETED;
        deletedAt = LocalDateTime.now();
        updatedAt = deletedAt;
    }

    public void takeDown(Long adminId, String reason, LocalDateTime now) {
        changeModeration(ModerationStatus.VISIBLE, ModerationStatus.HIDDEN, adminId, reason, now);
    }

    public void restore(Long adminId, String reason, LocalDateTime now) {
        changeModeration(ModerationStatus.HIDDEN, ModerationStatus.VISIBLE, adminId, reason, now);
    }

    public boolean isModerationVisible() {
        return ModerationStatus.VISIBLE.equals(moderationStatus);
    }

    public void toggleLike(Long userId) {
        if (likedUserIds.contains(userId)) {
            likedUserIds.remove(userId);
        } else {
            likedUserIds.add(userId);
        }
    }

    public boolean addLike(Long userId) {
        return likedUserIds.add(userId);
    }

    public boolean removeLike(Long userId) {
        return likedUserIds.remove(userId);
    }

    public void toggleFavorite(Long userId) {
        if (favoritedUserIds.contains(userId)) {
            favoritedUserIds.remove(userId);
        } else {
            favoritedUserIds.add(userId);
        }
    }

    public boolean addFavorite(Long userId) {
        return favoritedUserIds.add(userId);
    }

    public boolean removeFavorite(Long userId) {
        return favoritedUserIds.remove(userId);
    }

    public boolean likedBy(Long userId) {
        return likedUserIds.contains(userId);
    }

    public boolean favoritedBy(Long userId) {
        return favoritedUserIds.contains(userId);
    }

    public int getLikeCount() {
        return likedUserIds.size();
    }

    public int getFavoriteCount() {
        return favoritedUserIds.size();
    }

    public boolean isPublished() {
        return MomentStatus.PUBLISHED.equals(status);
    }

    public boolean isDeleted() {
        return MomentStatus.DELETED.equals(status);
    }

    public String getImageData() {
        return images.isEmpty() ? null : images.get(0).getImageData();
    }

    public List<String> getImageDataList() {
        return images.stream()
                .sorted(Comparator.comparing(MomentImage::getSortOrder)
                        .thenComparing(MomentImage::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(MomentImage::getImageData)
                .collect(Collectors.toUnmodifiableList());
    }

    private void changeModeration(ModerationStatus expected,
                                  ModerationStatus target,
                                  Long adminId,
                                  String reason,
                                  LocalDateTime now) {
        ModerationStatus current = moderationStatus == null ? ModerationStatus.VISIBLE : moderationStatus;
        if (!expected.equals(current)) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "Content moderation state has already changed");
        }
        validateModerationInputs(adminId, reason, now);
        moderationStatus = target;
        moderatedBy = adminId;
        moderatedAt = now;
        moderationReason = reason.trim();
    }

    private void validateModerationInputs(Long adminId, String reason, LocalDateTime now) {
        if (adminId == null || adminId <= 0 || now == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Administrator and moderation time are required");
        }
        if (reason == null || reason.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Moderation reason is required");
        }
        if (reason.trim().length() > 500) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Moderation reason is too long");
        }
    }
}
