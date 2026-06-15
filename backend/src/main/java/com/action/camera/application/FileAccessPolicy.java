package com.action.camera.application;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.security.UserRole;
import com.action.camera.delivery.entity.Delivery;
import com.action.camera.delivery.entity.DeliveryFile;
import com.action.camera.delivery.repository.DeliveryFileRepository;
import com.action.camera.delivery.repository.DeliveryRepository;
import com.action.camera.domain.FileRecord;
import com.action.camera.message.entity.Conversation;
import com.action.camera.message.entity.Message;
import com.action.camera.message.repository.ConversationRepository;
import com.action.camera.message.repository.MessageRepository;
import com.action.camera.order.entity.Order;
import com.action.camera.order.repository.OrderRepository;
import com.action.camera.photoauthorization.entity.PhotoAuthorization;
import com.action.camera.photoauthorization.entity.PhotoAuthorizationFile;
import com.action.camera.photoauthorization.repository.PhotoAuthorizationFileRepository;
import com.action.camera.photoauthorization.repository.PhotoAuthorizationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FileAccessPolicy {

    public static final String VISIBILITY_PUBLIC = "PUBLIC";
    public static final String VISIBILITY_PRIVATE = "PRIVATE";

    private static final Set<String> PUBLIC_BIZ_TYPES = Set.of(
            "AVATAR",
            "DEMAND_REFERENCE",
            "SERVICE_PORTFOLIO"
    );
    private static final Set<String> PRIVATE_BIZ_TYPES = Set.of(
            "DELIVERY",
            "PHOTO_AUTHORIZATION",
            "REVIEW_EVIDENCE",
            "CERTIFICATION"
    );
    private static final Set<String> SUPPORTED_BIZ_TYPES = Set.of(
            "AVATAR",
            "DEMAND_REFERENCE",
            "SERVICE_PORTFOLIO",
            "DELIVERY",
            "PHOTO_AUTHORIZATION",
            "REVIEW_EVIDENCE",
            "CERTIFICATION"
    );

    private final DeliveryFileRepository deliveryFileRepository;
    private final DeliveryRepository deliveryRepository;
    private final OrderRepository orderRepository;
    private final PhotoAuthorizationFileRepository photoAuthorizationFileRepository;
    private final PhotoAuthorizationRepository photoAuthorizationRepository;
    private final MessageRepository messageRepository;
    private final ConversationRepository conversationRepository;

    public String normalizeBizType(String bizType) {
        String normalized = normalize(bizType);
        if (!SUPPORTED_BIZ_TYPES.contains(normalized)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unsupported file bizType: " + bizType);
        }
        return normalized;
    }

    public String resolveVisibility(String bizType, String requestedVisibility) {
        String normalizedBizType = normalizeBizType(bizType);
        String normalizedVisibility = normalize(requestedVisibility);
        if (PUBLIC_BIZ_TYPES.contains(normalizedBizType)
                && VISIBILITY_PUBLIC.equals(normalizedVisibility)) {
            return VISIBILITY_PUBLIC;
        }
        if (PUBLIC_BIZ_TYPES.contains(normalizedBizType) || PRIVATE_BIZ_TYPES.contains(normalizedBizType)) {
            return VISIBILITY_PRIVATE;
        }
        throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unsupported file bizType: " + bizType);
    }

    public void assertCanDownload(FileRecord file, Long currentUserId, UserRole currentRole) {
        if (file == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "File not found");
        }
        if (Objects.equals(file.getUploaderId(), currentUserId)
                || currentRole == UserRole.ADMIN
                || isAllowedPublicFile(file)
                || canAccessDeliveryFile(file.getId(), currentUserId)
                || isGrantedPublicAuthorizationFile(file.getId())
                || canAccessConversationFile(file.getId(), currentUserId)) {
            return;
        }
        if (currentUserId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Authentication is required for this file");
        }
        throw new BusinessException(ErrorCode.FORBIDDEN, "No permission to access this file");
    }

    private boolean isAllowedPublicFile(FileRecord file) {
        return VISIBILITY_PUBLIC.equals(normalize(file.getVisibility()))
                && PUBLIC_BIZ_TYPES.contains(normalize(file.getBizType()));
    }

    private boolean canAccessDeliveryFile(Long fileId, Long userId) {
        if (fileId == null || userId == null) {
            return false;
        }
        List<DeliveryFile> deliveryFiles = deliveryFileRepository.findByFileId(fileId);
        Set<Long> deliveryIds = deliveryFiles.stream()
                .map(DeliveryFile::getDeliveryId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (deliveryIds.isEmpty()) {
            return false;
        }
        Set<Long> orderIds = deliveryRepository.findAllById(deliveryIds).stream()
                .map(Delivery::getOrderId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (orderIds.isEmpty()) {
            return false;
        }
        return orderRepository.findAllById(orderIds).stream()
                .anyMatch(order -> isOrderParticipant(order, userId));
    }

    private boolean isGrantedPublicAuthorizationFile(Long fileId) {
        if (fileId == null) {
            return false;
        }
        Set<Long> authorizationIds = photoAuthorizationFileRepository.findByFileIdIn(List.of(fileId)).stream()
                .map(PhotoAuthorizationFile::getAuthorizationId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (authorizationIds.isEmpty()) {
            return false;
        }
        return photoAuthorizationRepository.findAllById(authorizationIds).stream()
                .anyMatch(authorization -> PhotoAuthorization.STATUS_GRANTED.equals(authorization.getStatus())
                        && PhotoAuthorization.USAGE_SCOPE_PORTFOLIO_DISPLAY.equals(
                                authorization.getPhotoUsageScope())
                        && (authorization.getExpireTime() == null
                                || authorization.getExpireTime().isAfter(LocalDateTime.now())));
    }

    // The message schema already has file_id; this only defines access for future attachment support.
    private boolean canAccessConversationFile(Long fileId, Long userId) {
        if (fileId == null || userId == null) {
            return false;
        }
        Set<Long> conversationIds = messageRepository.findByFileId(fileId).stream()
                .map(Message::getConversationId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (conversationIds.isEmpty()) {
            return false;
        }
        return conversationRepository.findAllById(conversationIds).stream()
                .anyMatch(conversation -> isConversationParticipant(conversation, userId));
    }

    private boolean isOrderParticipant(Order order, Long userId) {
        return Objects.equals(order.getCustomerId(), userId)
                || Objects.equals(order.getProviderUserId(), userId);
    }

    private boolean isConversationParticipant(Conversation conversation, Long userId) {
        return conversation.hasParticipant(userId);
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }
}
