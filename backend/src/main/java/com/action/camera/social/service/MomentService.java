package com.action.camera.social.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.social.domain.MomentPost;
import com.action.camera.social.dto.CreateMomentRequest;
import com.action.camera.social.dto.MomentDto;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

@Service
public class MomentService {

    private final AtomicLong idGenerator = new AtomicLong(6000L);
    private final ConcurrentMap<Long, MomentPost> moments = new ConcurrentHashMap<>();

    public List<MomentDto> listMoments(CurrentUser user, String keyword) {
        String normalizedKeyword = trim(keyword);
        return moments.values().stream()
                .filter(moment -> matchesKeyword(moment, normalizedKeyword))
                .sorted(Comparator.comparing(MomentPost::getCreatedAt).reversed())
                .map(moment -> toDto(moment, user))
                .collect(Collectors.toList());
    }

    public MomentDto createMoment(CurrentUser user, CreateMomentRequest request) {
        if (request == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "请求体不能为空");
        }
        if (isBlank(request.getTitle())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "动态标题不能为空");
        }
        if (isBlank(request.getContent()) && isBlank(request.getImageData())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "动态文案或照片至少填写一项");
        }
        MomentPost moment = new MomentPost(
                idGenerator.incrementAndGet(),
                user.getUserId(),
                user.getRole().name(),
                trim(request.getTitle()),
                trim(request.getContent()),
                trim(request.getImageData()),
                normalizeMentions(request.getMentions()),
                LocalDateTime.now()
        );
        moments.put(moment.getId(), moment);
        return toDto(moment, user);
    }

    public MomentDto toggleLike(Long momentId, CurrentUser user) {
        MomentPost moment = moments.get(momentId);
        if (moment == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "动态不存在");
        }
        moment.toggleLike(user.getUserId());
        return toDto(moment, user);
    }

    public MomentDto toggleFavorite(Long momentId, CurrentUser user) {
        MomentPost moment = moments.get(momentId);
        if (moment == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "动态不存在");
        }
        moment.toggleFavorite(user.getUserId());
        return toDto(moment, user);
    }

    public MomentDto getMoment(Long momentId, CurrentUser user) {
        MomentPost moment = moments.get(momentId);
        if (moment == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "动态不存在");
        }
        return toDto(moment, user);
    }

    public void deleteMoment(Long momentId, CurrentUser user) {
        MomentPost moment = moments.get(momentId);
        if (moment == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "动态不存在");
        }
        if (!moment.getAuthorId().equals(user.getUserId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有动态作者可以删除该动态");
        }
        moments.remove(momentId);
    }

    private MomentDto toDto(MomentPost moment, CurrentUser user) {
        return new MomentDto(
                moment.getId(),
                moment.getAuthorId(),
                moment.getAuthorRole(),
                moment.getTitle(),
                moment.getContent(),
                moment.getImageData(),
                moment.getMentions(),
                moment.getLikeCount(),
                moment.likedBy(user.getUserId()),
                moment.getFavoriteCount(),
                moment.favoritedBy(user.getUserId()),
                moment.getCreatedAt()
        );
    }

    private boolean matchesKeyword(MomentPost moment, String keyword) {
        if (isBlank(keyword)) {
            return true;
        }
        String lowerKeyword = keyword.toLowerCase();
        return containsIgnoreCase(moment.getTitle(), lowerKeyword)
                || containsIgnoreCase(moment.getContent(), lowerKeyword);
    }

    private boolean containsIgnoreCase(String value, String lowerKeyword) {
        return value != null && value.toLowerCase().contains(lowerKeyword);
    }

    private List<String> normalizeMentions(List<String> mentions) {
        if (mentions == null) {
            return new ArrayList<>();
        }
        return mentions.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .distinct()
                .collect(Collectors.toList());
    }

    private String trim(String value) {
        return value == null ? null : value.trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
