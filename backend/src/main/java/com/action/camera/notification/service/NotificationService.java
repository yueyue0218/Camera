package com.action.camera.notification.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.notification.dto.NotificationCreateRequest;
import com.action.camera.notification.dto.NotificationResponse;
import com.action.camera.notification.entity.Notification;
import com.action.camera.notification.repository.NotificationRepository;
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

        Notification notification = new Notification();
        notification.setUserId(request.userId());
        notification.setTitle(request.title());
        notification.setContent(request.content());
        notification.setType(request.type());
        notification.setRelatedType(request.relatedType());
        notification.setRelatedId(request.relatedId());
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
                notification.getTitle(),
                notification.getContent(),
                notification.getType(),
                notification.getRelatedType(),
                notification.getRelatedId(),
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
}
