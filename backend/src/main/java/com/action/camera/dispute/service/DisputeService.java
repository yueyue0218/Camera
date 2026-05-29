package com.action.camera.dispute.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.dispute.dto.DisputeArbitrateRequest;
import com.action.camera.dispute.dto.DisputeCreateRequest;
import com.action.camera.dispute.dto.DisputeReplyRequest;
import com.action.camera.dispute.dto.DisputeReplyResponse;
import com.action.camera.dispute.dto.DisputeResponse;
import com.action.camera.dispute.entity.Dispute;
import com.action.camera.dispute.entity.DisputeReply;
import com.action.camera.dispute.event.DisputeResolvedEvent;
import com.action.camera.dispute.repository.DisputeReplyRepository;
import com.action.camera.dispute.repository.DisputeRepository;
import com.action.camera.domain.User;
import com.action.camera.notification.dto.NotificationCreateRequest;
import com.action.camera.notification.service.NotificationService;
import com.action.camera.order.entity.Order;
import com.action.camera.order.enums.OrderStatus;
import com.action.camera.order.repository.OrderRepository;
import com.action.camera.order.service.OrderService;
import com.action.camera.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@Transactional
@RequiredArgsConstructor
public class DisputeService {

    private static final String STATUS_OPEN = "OPEN";
    private static final String STATUS_REPLIED = "REPLIED";
    private static final String STATUS_RESOLVED = "RESOLVED";

    private static final String RES_FULL_REFUND = "FULL_REFUND";
    private static final String RES_PARTIAL_REFUND = "PARTIAL_REFUND";
    private static final String RES_REJECTED = "REJECTED";
    private static final String RES_REWORK = "REWORK";

    private static final String RELATED_TYPE = "DISPUTE";

    private final DisputeRepository disputeRepository;
    private final DisputeReplyRepository disputeReplyRepository;
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final OrderService orderService;
    private final NotificationService notificationService;
    private final ApplicationEventPublisher eventPublisher;

    public DisputeResponse createDispute(Long orderId, Long initiatorId, DisputeCreateRequest request) {
        validateReason(request.reason());

        Order order = getOrderOrThrow(orderId);

        if (!initiatorId.equals(order.getCustomerId()) && !initiatorId.equals(order.getProviderUserId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有订单双方可以发起申诉");
        }

        OrderStatus currentStatus = order.getStatus();
        if (currentStatus == OrderStatus.COMPLETED
                || currentStatus == OrderStatus.CANCELLED
                || currentStatus == OrderStatus.REFUNDED) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "订单已结束，无法发起申诉");
        }

        if (disputeRepository.existsByOrderIdAndStatusIn(orderId, List.of(STATUS_OPEN, STATUS_REPLIED))) {
            throw new BusinessException(ErrorCode.DUPLICATE_OPERATION, "该订单已有进行中的申诉");
        }

        orderService.changeStatus(orderId, initiatorId, OrderStatus.APPEALING, "用户发起申诉");

        Dispute dispute = new Dispute();
        dispute.setOrderId(orderId);
        dispute.setInitiatorId(initiatorId);
        dispute.setReason(request.reason().trim());
        dispute.setStatus(STATUS_OPEN);
        disputeRepository.save(dispute);

        Long otherPartyId = initiatorId.equals(order.getCustomerId())
                ? order.getProviderUserId() : order.getCustomerId();
        notify(otherPartyId, "订单申诉通知", "对方已对订单发起申诉，请及时回复。",
                "DISPUTE_CREATED", dispute.getId());

        return toResponse(dispute, List.of());
    }

    public DisputeResponse replyDispute(Long disputeId, Long replierId, DisputeReplyRequest request) {
        validateContent(request.content());

        Dispute dispute = getDisputeOrThrow(disputeId);

        if (!STATUS_OPEN.equals(dispute.getStatus())) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "只有 OPEN 状态的申诉可以回复");
        }

        Order order = getOrderOrThrow(dispute.getOrderId());
        boolean isParticipant = replierId.equals(order.getCustomerId())
                || replierId.equals(order.getProviderUserId());
        if (!isParticipant || replierId.equals(dispute.getInitiatorId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有订单另一方（非申诉发起人）可以回复");
        }

        DisputeReply reply = new DisputeReply();
        reply.setDisputeId(disputeId);
        reply.setReplierId(replierId);
        reply.setContent(request.content().trim());
        disputeReplyRepository.save(reply);

        dispute.setStatus(STATUS_REPLIED);
        dispute.setUpdatedAt(LocalDateTime.now());
        disputeRepository.save(dispute);

        notify(dispute.getInitiatorId(), "申诉回复通知", "对方已回复您的申诉，请查看。",
                "DISPUTE_REPLIED", disputeId);

        List<DisputeReply> replies = disputeReplyRepository.findByDisputeIdOrderByCreatedAtAsc(disputeId);
        return toResponse(dispute, replies);
    }

    public DisputeResponse arbitrate(Long disputeId, Long adminId, DisputeArbitrateRequest request) {
        requireAdmin(adminId);
        validateResolution(request.resolution());

        Dispute dispute = getDisputeOrThrow(disputeId);

        if (!STATUS_OPEN.equals(dispute.getStatus()) && !STATUS_REPLIED.equals(dispute.getStatus())) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "申诉已结案，无法再次裁定");
        }

        Order order = getOrderOrThrow(dispute.getOrderId());
        String resolution = request.resolution().trim();
        OrderStatus targetOrderStatus = resolveTargetStatus(resolution);

        orderService.changeStatus(dispute.getOrderId(), adminId, targetOrderStatus,
                "管理员裁定申诉，结果：" + resolution);

        if (RES_PARTIAL_REFUND.equals(resolution)) {
            orderRepository.findById(dispute.getOrderId()).ifPresent(o -> {
                o.setRefundStatus("PARTIAL");
                orderRepository.save(o);
            });
        }

        LocalDateTime now = LocalDateTime.now();
        dispute.setStatus(STATUS_RESOLVED);
        dispute.setResolution(resolution);
        dispute.setAdminId(adminId);
        dispute.setAdminComment(trimToNull(request.comment()));
        dispute.setResolvedAt(now);
        dispute.setUpdatedAt(now);
        disputeRepository.save(dispute);

        eventPublisher.publishEvent(
                new DisputeResolvedEvent(this, disputeId, dispute.getOrderId(), resolution));

        String notifyContent = "您的订单申诉裁定结果：" + resolution;
        notify(dispute.getInitiatorId(), "申诉裁定通知", notifyContent, "DISPUTE_RESOLVED", disputeId);
        Long otherPartyId = dispute.getInitiatorId().equals(order.getCustomerId())
                ? order.getProviderUserId() : order.getCustomerId();
        notify(otherPartyId, "申诉裁定通知", notifyContent, "DISPUTE_RESOLVED", disputeId);

        List<DisputeReply> replies = disputeReplyRepository.findByDisputeIdOrderByCreatedAtAsc(disputeId);
        return toResponse(dispute, replies);
    }

    @Transactional(readOnly = true)
    public DisputeResponse getDispute(Long disputeId, Long currentUserId) {
        Dispute dispute = getDisputeOrThrow(disputeId);
        Order order = getOrderOrThrow(dispute.getOrderId());
        requireParticipantOrAdmin(currentUserId, order);

        List<DisputeReply> replies = disputeReplyRepository.findByDisputeIdOrderByCreatedAtAsc(disputeId);
        return toResponse(dispute, replies);
    }

    @Transactional(readOnly = true)
    public List<DisputeResponse> listByOrder(Long orderId, Long currentUserId) {
        Order order = getOrderOrThrow(orderId);
        requireParticipantOrAdmin(currentUserId, order);

        return disputeRepository.findByOrderId(orderId).stream()
                .map(d -> toResponse(d,
                        disputeReplyRepository.findByDisputeIdOrderByCreatedAtAsc(d.getId())))
                .toList();
    }

    private void requireParticipantOrAdmin(Long userId, Order order) {
        boolean participant = userId.equals(order.getCustomerId())
                || userId.equals(order.getProviderUserId());
        if (!participant && !isAdmin(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有订单双方或管理员可以查看申诉");
        }
    }

    private void requireAdmin(Long userId) {
        if (!isAdmin(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "需要管理员权限才能裁定申诉");
        }
    }

    private boolean isAdmin(Long userId) {
        return userRepository.findById(userId)
                .map(User::getCurrentRole)
                .map("ADMIN"::equals)
                .orElse(false);
    }

    private OrderStatus resolveTargetStatus(String resolution) {
        return switch (resolution) {
            case RES_FULL_REFUND, RES_PARTIAL_REFUND -> OrderStatus.REFUNDED;
            case RES_REJECTED -> OrderStatus.COMPLETED;
            case RES_REWORK -> OrderStatus.REWORK_REQUIRED;
            default -> throw new BusinessException(ErrorCode.VALIDATION_ERROR, "未知裁定结果: " + resolution);
        };
    }

    private void notify(Long userId, String title, String content, String type, Long relatedId) {
        notificationService.createNotification(
                new NotificationCreateRequest(userId, title, content, type, RELATED_TYPE, relatedId));
    }

    private Order getOrderOrThrow(Long orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "订单不存在: " + orderId));
    }

    private Dispute getDisputeOrThrow(Long disputeId) {
        return disputeRepository.findById(disputeId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "申诉不存在: " + disputeId));
    }

    private void validateReason(String reason) {
        if (reason == null || reason.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "申诉原因不能为空");
        }
        if (reason.trim().length() > 1000) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "申诉原因不能超过 1000 字");
        }
    }

    private void validateContent(String content) {
        if (content == null || content.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "回复内容不能为空");
        }
        if (content.trim().length() > 2000) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "回复内容不能超过 2000 字");
        }
    }

    private void validateResolution(String resolution) {
        if (resolution == null || resolution.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "裁定结果不能为空");
        }
        if (!List.of(RES_FULL_REFUND, RES_PARTIAL_REFUND, RES_REJECTED, RES_REWORK)
                .contains(resolution.trim())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "不支持的裁定结果: " + resolution);
        }
    }

    private String trimToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }

    private DisputeResponse toResponse(Dispute dispute, List<DisputeReply> replies) {
        List<DisputeReplyResponse> replyResponses = replies.stream()
                .map(r -> new DisputeReplyResponse(
                        r.getId(), r.getDisputeId(), r.getReplierId(), r.getContent(), r.getCreatedAt()))
                .toList();
        return new DisputeResponse(
                dispute.getId(),
                dispute.getOrderId(),
                dispute.getInitiatorId(),
                dispute.getReason(),
                dispute.getStatus(),
                dispute.getResolution(),
                dispute.getAdminId(),
                dispute.getAdminComment(),
                dispute.getCreatedAt(),
                dispute.getUpdatedAt(),
                dispute.getResolvedAt(),
                replyResponses
        );
    }
}
