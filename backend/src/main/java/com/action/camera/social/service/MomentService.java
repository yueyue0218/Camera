package com.action.camera.social.service;

import com.action.camera.admin.domain.ModerationStatus;
import com.action.camera.admin.dto.ModerationView;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.notification.dto.NotificationCreateRequest;
import com.action.camera.notification.service.NotificationService;
import com.action.camera.social.domain.MomentPost;
import com.action.camera.social.domain.MomentStatus;
import com.action.camera.social.dto.CreateMomentRequest;
import com.action.camera.social.dto.MomentDto;
import com.action.camera.social.repository.MomentPostRepository;
import com.action.camera.social.repository.UserFollowRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class MomentService {

    private static final String NOTIFICATION_TYPE_MOMENT_LIKED = "MOMENT_LIKED";

    private final MomentPostRepository momentPostRepository;
    private final UserFollowRepository userFollowRepository;
    private final NotificationService notificationService;

    public MomentService(MomentPostRepository momentPostRepository,
                         UserFollowRepository userFollowRepository,
                         NotificationService notificationService) {
        this.momentPostRepository = momentPostRepository;
        this.userFollowRepository = userFollowRepository;
        this.notificationService = notificationService;
    }

    @Transactional(readOnly = true)
    public List<MomentDto> listMoments(CurrentUser user, String scope, Long authorId, String authorRole) {
        List<MomentPost> moments;
        if (authorId != null) {
            if (authorRole != null && !authorRole.isBlank()) {
                moments = momentPostRepository
                        .findByAuthorIdAndAuthorRoleAndStatusAndModerationStatusOrderByCreatedAtDesc(
                                authorId,
                                authorRole.toUpperCase(),
                                MomentStatus.PUBLISHED,
                                ModerationStatus.VISIBLE);
            } else {
                moments = momentPostRepository.findByAuthorIdAndStatusAndModerationStatusOrderByCreatedAtDesc(
                        authorId, MomentStatus.PUBLISHED, ModerationStatus.VISIBLE);
            }
        } else {
            moments = switch (normalizeScope(scope)) {
                case "hot" -> momentPostRepository
                        .findByStatusAndModerationStatusOrderByCreatedAtDesc(
                                MomentStatus.PUBLISHED, ModerationStatus.VISIBLE).stream()
                        .sorted(Comparator.comparingInt(this::hotScore).reversed()
                                .thenComparing(MomentPost::getCreatedAt, Comparator.reverseOrder()))
                        .toList();
                case "following" -> {
                    List<Long> followingUserIds = userFollowRepository
                            .findFollowingUserIdsByFollowerId(user.getUserId());
                    if (followingUserIds.isEmpty()) {
                        yield Collections.emptyList();
                    }
                    yield momentPostRepository
                            .findByAuthorIdInAndStatusAndModerationStatusOrderByCreatedAtDesc(
                                    followingUserIds,
                                    MomentStatus.PUBLISHED,
                                    ModerationStatus.VISIBLE);
                }
                default -> momentPostRepository.findByStatusAndModerationStatusOrderByCreatedAtDesc(
                        MomentStatus.PUBLISHED, ModerationStatus.VISIBLE);
            };
        }
        return moments.stream()
                .map(moment -> toListDto(moment, user))
                .collect(Collectors.toList());
    }

    @Transactional
    public MomentDto createMoment(CurrentUser user, CreateMomentRequest request) {
        validateCreateRequest(request);
        List<String> imageDataList = resolveImages(request, null);

        MomentPost moment = new MomentPost();
        moment.setAuthorId(user.getUserId());
        moment.setAuthorRole(user.getRole().name());
        moment.setTitle(normalizeOptionalText(request.getTitle(), 50, "动态标题"));
        moment.setContent(normalizeOptionalText(request.getContent(), 1000, "动态正文"));
        moment.setStatus(MomentStatus.PUBLISHED);
        moment.replaceMentions(normalizeMentions(request.getMentions()));
        moment.replaceImages(imageDataList);

        return toDto(momentPostRepository.save(moment), user);
    }

    @Transactional(readOnly = true)
    public MomentDto getMoment(Long momentId, CurrentUser user) {
        MomentPost moment = requireVisibleMoment(momentId, user);
        return toDto(moment, user);
    }

    @Transactional
    public MomentDto updateMoment(Long momentId, CurrentUser user, CreateMomentRequest request) {
        MomentPost moment = requireEditableMoment(momentId, user);
        validateCreateRequestForEdit(request);

        moment.getImages().clear();
        momentPostRepository.flush();
        moment.setTitle(normalizeOptionalText(request.getTitle(), 50, "动态标题"));
        moment.setContent(normalizeOptionalText(request.getContent(), 1000, "动态正文"));
        moment.replaceMentions(normalizeMentions(request.getMentions()));
        List<String> imageDataList = resolveImages(request, moment);
        moment.replaceImages(imageDataList);

        return toDto(momentPostRepository.save(moment), user);
    }

    @Transactional
    public MomentDto toggleLike(Long momentId, CurrentUser user) {
        MomentPost moment = requireInteractiveMoment(momentId);
        if (moment.likedBy(user.getUserId())) {
            unlikeMomentInternal(moment, user, false);
        } else {
            likeMomentInternal(moment, user, false);
        }
        return toDto(momentPostRepository.save(moment), user);
    }

    @Transactional
    public MomentDto toggleFavorite(Long momentId, CurrentUser user) {
        MomentPost moment = requireInteractiveMoment(momentId);
        if (moment.favoritedBy(user.getUserId())) {
            unlikeFavoriteInternal(moment, user);
        } else {
            likeFavoriteInternal(moment, user);
        }
        return toDto(momentPostRepository.save(moment), user);
    }

    @Transactional
    public MomentDto likeMoment(Long momentId, CurrentUser user) {
        MomentPost moment = requireInteractiveMoment(momentId);
        likeMomentInternal(moment, user, true);
        return toDto(momentPostRepository.save(moment), user);
    }

    @Transactional
    public MomentDto unlikeMoment(Long momentId, CurrentUser user) {
        MomentPost moment = requireInteractiveMoment(momentId);
        unlikeMomentInternal(moment, user, true);
        return toDto(momentPostRepository.save(moment), user);
    }

    @Transactional
    public MomentDto favoriteMoment(Long momentId, CurrentUser user) {
        MomentPost moment = requireInteractiveMoment(momentId);
        likeFavoriteInternal(moment, user);
        return toDto(momentPostRepository.save(moment), user);
    }

    @Transactional
    public MomentDto unfavoriteMoment(Long momentId, CurrentUser user) {
        MomentPost moment = requireInteractiveMoment(momentId);
        unlikeFavoriteInternal(moment, user);
        return toDto(momentPostRepository.save(moment), user);
    }

    @Transactional
    public void deleteMoment(Long momentId, CurrentUser user) {
        MomentPost moment = requireExistingMoment(momentId);
        if (moment.isDeleted()) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "动态已处于删除状态");
        }
        if (!Objects.equals(moment.getAuthorId(), user.getUserId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有动态作者可以删除该动态");
        }
        moment.markDeleted();
        momentPostRepository.save(moment);
    }

    private MomentDto toDto(MomentPost moment, CurrentUser user) {
        return new MomentDto(
                moment.getId(),
                moment.getAuthorId(),
                moment.getAuthorRole(),
                moment.getTitle(),
                moment.getContent(),
                moment.getImageData(),
                moment.getImageDataList(),
                moment.getMentions(),
                moment.getLikeCount(),
                moment.likedBy(user.getUserId()),
                moment.getFavoriteCount(),
                moment.favoritedBy(user.getUserId()),
                moment.getCreatedAt(),
                moment.getUpdatedAt(),
                moment.getDeletedAt(),
                moment.getStatus().name(),
                isPrivileged(moment, user) ? moderationView(moment) : null
        );
    }

    private MomentDto toListDto(MomentPost moment, CurrentUser user) {
        List<String> previewImages = moment.getImageDataList().stream()
                .limit(3)
                .collect(Collectors.toList());
        String previewImage = previewImages.isEmpty()
                ? moment.getImageData()
                : previewImages.get(0);
        return new MomentDto(
                moment.getId(),
                moment.getAuthorId(),
                moment.getAuthorRole(),
                moment.getTitle(),
                moment.getContent(),
                previewImage,
                previewImages,
                moment.getMentions(),
                moment.getLikeCount(),
                moment.likedBy(user.getUserId()),
                moment.getFavoriteCount(),
                moment.favoritedBy(user.getUserId()),
                moment.getCreatedAt(),
                moment.getUpdatedAt(),
                moment.getDeletedAt(),
                moment.getStatus().name()
        );
    }

    private ModerationView moderationView(MomentPost moment) {
        return new ModerationView(
                moment.getModerationStatus(),
                moment.getModeratedAt(),
                moment.getModerationReason());
    }

    private void validateCreateRequest(CreateMomentRequest request) {
        if (request == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "请求体不能为空");
        }
        normalizeOptionalText(request.getTitle(), 50, "动态标题");
        normalizeOptionalText(request.getContent(), 1000, "动态正文");
        List<String> imageDataList = normalizeImages(request);
        if (imageDataList.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "动态图片至少上传 1 张");
        }
        if (imageDataList.size() > 9) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "动态图片最多上传 9 张");
        }
    }

    private void validateCreateRequestForEdit(CreateMomentRequest request) {
        if (request == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "请求体不能为空");
        }
        normalizeOptionalText(request.getTitle(), 50, "动态标题");
        normalizeOptionalText(request.getContent(), 1000, "动态正文");
        List<String> imageDataList = normalizeImages(request);
        if (imageDataList.size() > 9) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "动态图片最多上传 9 张");
        }
    }

    private MomentPost requireExistingMoment(Long momentId) {
        return momentPostRepository.findById(momentId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "动态不存在"));
    }

    private MomentPost requireVisibleMoment(Long momentId, CurrentUser user) {
        MomentPost moment = requireExistingMoment(momentId);
        if (moment.isPublished() && moment.isModerationVisible()) {
            return moment;
        }
        if (isPrivileged(moment, user)) {
            return moment;
        }
        throw new BusinessException(ErrorCode.NOT_FOUND, "动态不存在");
    }

    private MomentPost requireEditableMoment(Long momentId, CurrentUser user) {
        MomentPost moment = requireExistingMoment(momentId);
        if (!moment.isPublished()) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "只有已发布的动态可以编辑");
        }
        if (!Objects.equals(moment.getAuthorId(), user.getUserId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有动态作者可以编辑该动态");
        }
        return moment;
    }

    private MomentPost requireInteractiveMoment(Long momentId) {
        MomentPost moment = requireExistingMoment(momentId);
        if (!moment.isPublished() || !moment.isModerationVisible()) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "当前状态不允许互动");
        }
        return moment;
    }

    private boolean isPrivileged(MomentPost moment, CurrentUser user) {
        return user != null && (user.isAdmin() || Objects.equals(moment.getAuthorId(), user.getUserId()));
    }

    private void likeMomentInternal(MomentPost moment, CurrentUser user, boolean notifyAuthor) {
        boolean changed = moment.addLike(user.getUserId());
        if (changed && notifyAuthor && !Objects.equals(moment.getAuthorId(), user.getUserId())) {
            notificationService.createNotification(new NotificationCreateRequest(
                    moment.getAuthorId(),
                    user.getUserId(),
                    "动态收到点赞",
                    "你的动态收到了一条新的点赞",
                    NOTIFICATION_TYPE_MOMENT_LIKED,
                    NOTIFICATION_TYPE_MOMENT_LIKED,
                    "MOMENT",
                    moment.getId(),
                    "MOMENT",
                    moment.getId(),
                    "MOMENT_LIKE",
                    moment.getId(),
                    "moment:like:" + moment.getId() + ":" + user.getUserId(),
                    null
            ));
        }
    }

    private void unlikeMomentInternal(MomentPost moment, CurrentUser user, boolean allowNoop) {
        boolean removed = moment.removeLike(user.getUserId());
        if (!removed && !allowNoop) {
            throw new BusinessException(ErrorCode.DUPLICATE_OPERATION, "重复取消点赞");
        }
    }

    private void likeFavoriteInternal(MomentPost moment, CurrentUser user) {
        moment.addFavorite(user.getUserId());
    }

    private void unlikeFavoriteInternal(MomentPost moment, CurrentUser user) {
        moment.removeFavorite(user.getUserId());
    }

    private List<String> normalizeMentions(List<String> mentions) {
        if (mentions == null) {
            return new ArrayList<>();
        }
        return mentions.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .peek(value -> {
                    if (value.length() > 100) {
                        throw new BusinessException(ErrorCode.VALIDATION_ERROR, "提及内容不能超过100个字符");
                    }
                })
                .distinct()
                .limit(20)
                .collect(Collectors.toList());
    }

    private String normalizeOptionalText(String value, int maxLength, String fieldName) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        if (normalized.isEmpty()) {
            return null;
        }
        if (normalized.length() > maxLength) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    fieldName + "不能超过" + maxLength + "个字符");
        }
        return normalized;
    }

    private List<String> resolveImages(CreateMomentRequest request, MomentPost existingMoment) {
        List<String> normalizedImages = normalizeImages(request);
        if (!normalizedImages.isEmpty()) {
            return normalizedImages;
        }
        if (existingMoment != null) {
            return existingMoment.getImageDataList();
        }
        return normalizedImages;
    }

    private List<String> normalizeImages(CreateMomentRequest request) {
        List<String> sourceImages = request.getImageDataList();
        if (sourceImages != null && !sourceImages.isEmpty()) {
            return sourceImages.stream()
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(value -> !value.isBlank())
                    .map(this::validateImageData)
                    .distinct()
                    .collect(Collectors.toList());
        }
        if (!isBlank(request.getImageData())) {
            return List.of(validateImageData(request.getImageData().trim()));
        }
        return new ArrayList<>();
    }

    private String validateImageData(String imageData) {
        return imageData;
    }

    private String normalizeScope(String scope) {
        return scope == null || scope.isBlank() ? "latest" : scope.trim().toLowerCase();
    }

    private int hotScore(MomentPost moment) {
        return moment.getLikeCount() * 2 + moment.getFavoriteCount() * 3;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
