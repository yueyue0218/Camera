package com.action.camera.notification.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.page.PageResult;
import com.action.camera.notification.dto.NotificationCreateRequest;
import com.action.camera.notification.dto.NotificationResponse;
import com.action.camera.notification.entity.Notification;
import com.action.camera.notification.repository.NotificationRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @Transactional
    public NotificationResponse createNotification(NotificationCreateRequest request) {
        validateCreateRequest(request);
        if (!isBlank(request.dedupeKey())) {
            return notificationRepository.findByDedupeKey(request.dedupeKey())
                    .map(this::toResponse)
                    .orElseGet(() -> saveNotification(request));
        }
        return saveNotification(request);
    }

    private NotificationResponse saveNotification(NotificationCreateRequest request) {
        Notification notification = new Notification();
        notification.setUserId(request.userId());
        notification.setActorUserId(request.actorUserId());
        notification.setTitle(request.title());
        notification.setContent(request.content());
        notification.setType(request.type());
        notification.setEventType(defaultIfBlank(request.eventType(), request.type()));
        notification.setRelatedType(request.relatedType());
        notification.setRelatedId(request.relatedId());
        notification.setTargetType(defaultIfBlank(request.targetType(), request.relatedType()));
        notification.setTargetId(request.targetId() != null ? request.targetId() : request.relatedId());
        notification.setSourceType(defaultIfBlank(request.sourceType(), request.relatedType()));
        notification.setSourceId(request.sourceId() != null ? request.sourceId() : request.relatedId());
        notification.setDedupeKey(trimToNull(request.dedupeKey()));
        notification.setMetadataJson(trimToNull(request.metadataJson()));
        notification.setIsRead(false);
        notification.setCreatedAt(LocalDateTime.now());

        return toResponse(notificationRepository.save(notification));
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> listMine() {
        Long currentUserId = requireCurrentUserId();
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(currentUserId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PageResult<NotificationResponse> listMine(Integer page, Integer size, Boolean isRead) {
        Long currentUserId = requireCurrentUserId();
        int normalizedPage = normalizePage(page);
        int normalizedSize = normalizeSize(size);
        PageRequest pageRequest = PageRequest.of(normalizedPage, normalizedSize);
        Page<Notification> notifications = isRead == null
                ? notificationRepository.findByUserIdOrderByCreatedAtDesc(currentUserId, pageRequest)
                : notificationRepository.findByUserIdAndIsReadOrderByCreatedAtDesc(currentUserId, isRead, pageRequest);
        return new PageResult<>(
                notifications.getContent().stream().map(this::toResponse).toList(),
                normalizedPage,
                normalizedSize,
                notifications.getTotalElements()
        );
    }

    @Transactional(readOnly = true)
    public long unreadCount() {
        return notificationRepository.countByUserIdAndIsReadFalse(requireCurrentUserId());
    }

    @Transactional
    public NotificationResponse markRead(Long notificationId) {
        Long currentUserId = requireCurrentUserId();
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "通知不存在"));
        if (!currentUserId.equals(notification.getUserId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只能操作自己的通知");
        }
        if (!Boolean.TRUE.equals(notification.getIsRead())) {
            notification.setIsRead(true);
        }
        return toResponse(notification);
    }

    @Transactional
    public List<NotificationResponse> markAllRead() {
        Long currentUserId = requireCurrentUserId();
        List<Notification> unreadNotifications = notificationRepository.findByUserIdAndIsReadFalse(currentUserId);
        unreadNotifications.forEach(notification -> notification.setIsRead(true));
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(currentUserId).stream()
                .map(this::toResponse)
                .toList();
    }

    private void validateCreateRequest(NotificationCreateRequest request) {
        if (request == null
                || request.userId() == null
                || isBlank(request.title())
                || isBlank(request.content())
                || isBlank(request.type())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "通知接收人、标题、内容和类型不能为空");
        }
    }

    private NotificationResponse toResponse(Notification notification) {
        return new NotificationResponse(
                notification.getId(),
                notification.getUserId(),
                notification.getActorUserId(),
                notification.getTitle(),
                notification.getContent(),
                notification.getType(),
                notification.getEventType(),
                notification.getRelatedType(),
                notification.getRelatedId(),
                notification.getTargetType(),
                notification.getTargetId(),
                notification.getSourceType(),
                notification.getSourceId(),
                notification.getDedupeKey(),
                notification.getMetadataJson(),
                notification.getIsRead(),
                notification.getCreatedAt()
        );
    }

    private Long requireCurrentUserId() {
        Long currentUserId = UserContext.getUserId();
        if (currentUserId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return currentUserId;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String trimToNull(String value) {
        return isBlank(value) ? null : value.trim();
    }

    private String defaultIfBlank(String value, String fallback) {
        return isBlank(value) ? fallback : value.trim();
    }

    private int normalizePage(Integer page) {
        return page == null || page < 0 ? 0 : page;
    }

    private int normalizeSize(Integer size) {
        if (size == null || size <= 0) {
            return 20;
        }
        return Math.min(size, 100);
    }
}
