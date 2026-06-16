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
    public FollowStateResponse follow(Long targetUserId, String targetRole, CurrentUser currentUser) {
        validateTargetUser(targetUserId);
        Long currentUserId = requireCurrentUserId(currentUser);
        if (Objects.equals(currentUserId, targetUserId)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "不能关注自己");
        }
        String role = normalizeRole(targetRole);
        boolean existed = userFollowRepository.existsByFollowerIdAndFollowingUserIdAndTargetRole(currentUserId, targetUserId, role);
        if (!existed) {
            try {
                userFollowRepository.save(new UserFollow(currentUserId, targetUserId, role));
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
                        "user:follow:" + currentUserId + ":" + targetUserId + ":" + role,
                        null
                ));
            } catch (DataIntegrityViolationException ex) {
                // Concurrent follow requests can race on the unique constraint; treat as idempotent.
            }
        }
        return buildFollowState(targetUserId, role, currentUserId);
    }

    @Transactional
    public FollowStateResponse unfollow(Long targetUserId, String targetRole, CurrentUser currentUser) {
        validateTargetUser(targetUserId);
        Long currentUserId = requireCurrentUserId(currentUser);
        if (Objects.equals(currentUserId, targetUserId)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "不能取消关注自己");
        }
        String role = normalizeRole(targetRole);
        userFollowRepository.findByFollowerIdAndFollowingUserIdAndTargetRole(currentUserId, targetUserId, role)
                .ifPresent(userFollowRepository::delete);
        return buildFollowState(targetUserId, role, currentUserId);
    }

    @Transactional(readOnly = true)
    public List<SocialUserBriefResponse> listFollowers(Long userId, String targetRole, CurrentUser currentUser) {
        validateTargetUser(userId);
        Long currentUserId = requireCurrentUserId(currentUser);
        List<UserFollow> follows = (targetRole != null && !targetRole.isBlank())
                ? userFollowRepository.findByFollowingUserIdAndTargetRoleOrderByCreatedAtDesc(userId, normalizeRole(targetRole))
                : userFollowRepository.findByFollowingUserIdOrderByCreatedAtDesc(userId);
        return follows.stream()
                .map(follow -> toUserBrief(follow.getFollowerId(), currentUserId))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SocialUserBriefResponse> listFollowing(Long userId, String targetRole, CurrentUser currentUser) {
        validateTargetUser(userId);
        Long currentUserId = requireCurrentUserId(currentUser);
        List<UserFollow> follows = (targetRole != null && !targetRole.isBlank())
                ? userFollowRepository.findByFollowerIdAndTargetRoleOrderByCreatedAtDesc(userId, normalizeRole(targetRole))
                : userFollowRepository.findByFollowerIdOrderByCreatedAtDesc(userId);
        return follows.stream()
                .map(follow -> toUserBrief(follow.getFollowingUserId(), currentUserId))
                .toList();
    }

    @Transactional(readOnly = true)
    public PublicProfileResponse getPublicProfile(Long userId, String role, CurrentUser currentUser) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "用户不存在"));
        Long currentUserId = requireCurrentUserId(currentUser);
        String resolvedRole = (role != null && !role.isBlank()) ? role.toUpperCase() : user.getCurrentRole();
        boolean isProvider = "PROVIDER".equalsIgnoreCase(resolvedRole);

        long followerCount = userFollowRepository.countByFollowingUserIdAndTargetRole(userId, resolvedRole);
        long followingCount = userFollowRepository.countByFollowerIdAndTargetRole(userId, resolvedRole);
        boolean followedByCurrentUser = userFollowRepository.existsByFollowerIdAndFollowingUserId(currentUserId, userId);
        long momentCount = momentPostRepository.countByAuthorIdAndAuthorRoleAndStatus(userId, resolvedRole, MomentStatus.PUBLISHED);

        ProviderProfilePublicVO providerProfile = isProvider
                ? providerProfileMapper.selectPublicProfile(userId)
                : null;

        String nickname;
        Long avatarFileId;
        String bio;
        if (isProvider && providerProfile != null) {
            nickname = providerProfile.getNickname() != null ? providerProfile.getNickname() : user.getNickname();
            avatarFileId = providerProfile.getProviderAvatarFileId() != null
                    ? providerProfile.getProviderAvatarFileId()
                    : user.getAvatarFileId();
            bio = providerProfile.getBio() != null ? providerProfile.getBio() : user.getBio();
        } else {
            nickname = user.getNickname();
            avatarFileId = user.getAvatarFileId();
            bio = user.getBio();
        }

        return new PublicProfileResponse(
                user.getId(),
                nickname,
                avatarFileId,
                bio,
                resolvedRole,
                followerCount,
                followingCount,
                followedByCurrentUser,
                momentCount,
                providerProfile,
                user.getCityCode()
        );
    }

    private FollowStateResponse buildFollowState(Long targetUserId, String targetRole, Long currentUserId) {
        return new FollowStateResponse(
                targetUserId,
                userFollowRepository.existsByFollowerIdAndFollowingUserIdAndTargetRole(currentUserId, targetUserId, targetRole),
                userFollowRepository.countByFollowingUserIdAndTargetRole(targetUserId, targetRole),
                userFollowRepository.countByFollowerIdAndTargetRole(currentUserId, targetRole)
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

    private String normalizeRole(String role) {
        return (role != null && !role.isBlank()) ? role.toUpperCase() : "CUSTOMER";
    }
}
