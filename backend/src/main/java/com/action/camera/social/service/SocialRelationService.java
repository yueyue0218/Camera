package com.action.camera.social.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.domain.User;
import com.action.camera.notification.dto.NotificationCreateRequest;
import com.action.camera.notification.service.NotificationService;
import com.action.camera.provider.dto.ProviderProfilePublicVO;
import com.action.camera.provider.mapper.ProviderProfileMapper;
import com.action.camera.repository.UserRepository;
import com.action.camera.social.domain.MomentPost;
import com.action.camera.social.domain.MomentStatus;
import com.action.camera.social.domain.UserFollow;
import com.action.camera.social.dto.FollowStateResponse;
import com.action.camera.social.dto.PublicProfileResponse;
import com.action.camera.social.dto.SocialUserBriefResponse;
import com.action.camera.social.repository.MomentPostRepository;
import com.action.camera.social.repository.UserFollowRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;

@Service
public class SocialRelationService {

    private static final String NOTIFICATION_TYPE_FOLLOWED = "FOLLOWED";

    private final UserFollowRepository userFollowRepository;
    private final UserRepository userRepository;
    private final MomentPostRepository momentPostRepository;
    private final NotificationService notificationService;
    private final ProviderProfileMapper providerProfileMapper;

    public SocialRelationService(UserFollowRepository userFollowRepository,
                                 UserRepository userRepository,
                                 MomentPostRepository momentPostRepository,
                                 NotificationService notificationService,
                                 ProviderProfileMapper providerProfileMapper) {
        this.userFollowRepository = userFollowRepository;
        this.userRepository = userRepository;
        this.momentPostRepository = momentPostRepository;
        this.notificationService = notificationService;
        this.providerProfileMapper = providerProfileMapper;
    }

    @Transactional
    public FollowStateResponse follow(Long targetUserId, CurrentUser currentUser) {
        validateTargetUser(targetUserId);
        Long currentUserId = requireCurrentUserId(currentUser);
        if (Objects.equals(currentUserId, targetUserId)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "不能关注自己");
        }
        boolean existed = userFollowRepository.existsByFollowerIdAndFollowingUserId(currentUserId, targetUserId);
        if (!existed) {
            try {
                userFollowRepository.save(new UserFollow(currentUserId, targetUserId));
                notificationService.createNotification(new NotificationCreateRequest(
                        targetUserId,
                        currentUserId,
                        "收到新的关注",
                        "有用户关注了你",
                        NOTIFICATION_TYPE_FOLLOWED,
                        NOTIFICATION_TYPE_FOLLOWED,
                        "USER",
                        currentUserId,
                        "USER",
                        currentUserId,
                        "USER_FOLLOW",
                        currentUserId,
                        "user:follow:" + currentUserId + ":" + targetUserId,
                        null
                ));
            } catch (DataIntegrityViolationException ex) {
                // Concurrent follow requests can race on the unique constraint; treat as idempotent.
            }
        }
        return buildFollowState(targetUserId, currentUserId);
    }

    @Transactional
    public FollowStateResponse unfollow(Long targetUserId, CurrentUser currentUser) {
        validateTargetUser(targetUserId);
        Long currentUserId = requireCurrentUserId(currentUser);
        if (Objects.equals(currentUserId, targetUserId)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "不能取消关注自己");
        }
        userFollowRepository.findByFollowerIdAndFollowingUserId(currentUserId, targetUserId)
                .ifPresent(userFollowRepository::delete);
        return buildFollowState(targetUserId, currentUserId);
    }

    @Transactional(readOnly = true)
    public List<SocialUserBriefResponse> listFollowers(Long userId, CurrentUser currentUser) {
        validateTargetUser(userId);
        Long currentUserId = requireCurrentUserId(currentUser);
        return userFollowRepository.findByFollowingUserIdOrderByCreatedAtDesc(userId).stream()
                .map(follow -> toUserBrief(follow.getFollowerId(), currentUserId))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SocialUserBriefResponse> listFollowing(Long userId, CurrentUser currentUser) {
        validateTargetUser(userId);
        Long currentUserId = requireCurrentUserId(currentUser);
        return userFollowRepository.findByFollowerIdOrderByCreatedAtDesc(userId).stream()
                .map(follow -> toUserBrief(follow.getFollowingUserId(), currentUserId))
                .toList();
    }

    @Transactional(readOnly = true)
    public PublicProfileResponse getPublicProfile(Long userId, CurrentUser currentUser) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "用户不存在"));
        Long currentUserId = requireCurrentUserId(currentUser);
        long followerCount = userFollowRepository.countByFollowingUserId(userId);
        long followingCount = userFollowRepository.countByFollowerId(userId);
        boolean followedByCurrentUser = userFollowRepository.existsByFollowerIdAndFollowingUserId(currentUserId, userId);
        long momentCount = momentPostRepository.countByAuthorIdAndStatus(userId, MomentStatus.PUBLISHED);
        ProviderProfilePublicVO providerProfile = "PROVIDER".equalsIgnoreCase(user.getCurrentRole())
                ? providerProfileMapper.selectPublicProfile(userId)
                : null;
        return new PublicProfileResponse(
                user.getId(),
                user.getNickname(),
                user.getAvatarFileId(),
                user.getBio(),
                user.getCurrentRole(),
                followerCount,
                followingCount,
                followedByCurrentUser,
                momentCount,
                providerProfile
        );
    }

    private FollowStateResponse buildFollowState(Long targetUserId, Long currentUserId) {
        return new FollowStateResponse(
                targetUserId,
                userFollowRepository.existsByFollowerIdAndFollowingUserId(currentUserId, targetUserId),
                userFollowRepository.countByFollowingUserId(targetUserId),
                userFollowRepository.countByFollowerId(currentUserId)
        );
    }

    private SocialUserBriefResponse toUserBrief(Long userId, Long currentUserId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "用户不存在"));
        boolean followedByCurrentUser = userFollowRepository.existsByFollowerIdAndFollowingUserId(currentUserId, userId);
        return new SocialUserBriefResponse(
                user.getId(),
                user.getNickname(),
                user.getAvatarFileId(),
                user.getCurrentRole(),
                user.getBio(),
                followedByCurrentUser
        );
    }

    private void validateTargetUser(Long userId) {
        if (userId == null || userId <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "用户 ID 不能为空");
        }
        if (userRepository.findById(userId).isEmpty()) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "用户不存在");
        }
    }

    private Long requireCurrentUserId(CurrentUser currentUser) {
        if (currentUser == null || currentUser.getUserId() == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return currentUser.getUserId();
    }
}
