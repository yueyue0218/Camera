package com.action.camera.order.service;

import com.action.camera.application.OrderDisplayService;
import com.action.camera.application.UserDisplayService;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.security.UserRole;
import com.action.camera.delivery.repository.DeliveryRepository;
import com.action.camera.message.entity.Quote;
import com.action.camera.message.enums.QuoteStatus;
import com.action.camera.message.repository.ConversationRepository;
import com.action.camera.message.service.ConversationService;
import com.action.camera.notification.dto.NotificationCreateRequest;
import com.action.camera.notification.service.NotificationService;
import com.action.camera.order.entity.Order;
import com.action.camera.order.entity.OrderStatusLog;
import com.action.camera.order.entity.PaymentRecord;
import com.action.camera.order.enums.EscrowStatus;
import com.action.camera.order.enums.OrderStatus;
import com.action.camera.order.repository.OrderRepository;
import com.action.camera.order.repository.OrderStatusLogRepository;
import com.action.camera.order.repository.PaymentRecordRepository;
import com.action.camera.order.statemachine.OrderStatusMachine;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class OrderService {

    public static final String MOCK_PAY_METHOD = "MOCK_PAY";
    private static final int REWORK_REASON_MAX_LENGTH = 200;
    private static final String PAYMENT_SUCCESS = "SUCCESS";
    private static final String PAYMENT_REFUNDED = "REFUNDED";
    private static final String PAYMENT_PARTIAL_REFUNDED = "PARTIAL_REFUNDED";
    private static final String SETTLEMENT_NOT_SETTLED = "NOT_SETTLED";
    private static final String SETTLEMENT_SETTLED = "SETTLED";
    private static final String REFUND_NONE = "NONE";
    private static final String REFUND_SUCCESS = "REFUNDED";
    private static final String REFUND_PARTIAL_SUCCESS = "PARTIAL_REFUNDED";
    private static final String SOURCE_TYPE_SERVICE_PACKAGE = "SERVICE_PACKAGE";
    private static final String SYSTEM_OPERATOR_ROLE = "SYSTEM";
    private static final String AUTO_CONFIRM_REASON = "交付后 7 天未操作，系统自动确认完成";
    private static final String AUTO_SHOOTING_START_REASON = "系统根据拍摄开始时间自动进入拍摄中";
    private static final String AUTO_SHOOTING_END_REASON = "系统根据拍摄结束时间自动进入待交付";
    private static final String AUTO_REFUND_UNDELIVERED_REASON = "超过最晚交付时间仍未上传作品，系统自动退款并结束订单";
    private static final List<OrderStatus> DISPUTE_RESTORABLE_STATUSES = List.of(
            OrderStatus.PAID_PENDING_SHOOT,
            OrderStatus.SHOOTING,
            OrderStatus.PENDING_DELIVERY,
            OrderStatus.DELIVERED_PENDING_CONFIRM,
            OrderStatus.REWORK_REQUIRED
    );
    private static final List<OrderStatus> PROVIDER_TIME_CONFLICT_STATUSES = List.of(
            OrderStatus.PENDING_PAYMENT,
            OrderStatus.PAID_PENDING_SHOOT,
            OrderStatus.SHOOTING,
            OrderStatus.PENDING_DELIVERY,
            OrderStatus.DELIVERED_PENDING_CONFIRM,
            OrderStatus.REWORK_REQUIRED,
            OrderStatus.APPEALING,
            OrderStatus.COMPLETED
    );

    private final OrderRepository orderRepository;
    private final PaymentRecordRepository paymentRecordRepository;
    private final OrderStatusLogRepository orderStatusLogRepository;
    private final DeliveryRepository deliveryRepository;
    private final UserDisplayService userDisplayService;
    private final OrderDisplayService orderDisplayService;

    @Autowired(required = false)
    private ConversationRepository conversationRepository;

    @Autowired(required = false)
    private NotificationService notificationService;

    @Transactional
    public Order createOrderFromConfirmedQuote(Quote quote) {
        validateConfirmedQuote(quote);

        Optional<Order> existingOrder = orderRepository.findByQuoteId(quote.getId());
        if (existingOrder.isPresent()) {
            Order order = existingOrder.get();
            bindServicePackageConversationToOrder(order);
            return order;
        }
        ensureProviderTimeAvailable(
                quote.getProviderUserId(),
                quote.getShootStartTime(),
                quote.getShootEndTime());
        Order savedOrder = orderRepository.save(buildOrderFromQuote(quote));
        bindServicePackageConversationToOrder(savedOrder);
        return savedOrder;
    }

    @Transactional
    public Order mockPay(Long orderId, Long payerId, Long amountCent) {
        Order order = getOrderForUpdateOrThrow(orderId);

        if (!Objects.equals(order.getCustomerId(), payerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only the customer can pay this order");
        }
        if (!Objects.equals(order.getTotalAmountCent(), amountCent)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Payment amount does not match order amount");
        }

        Optional<PaymentRecord> existingPayment = paymentRecordRepository.findByOrderId(order.getId());
        if (existingPayment.isPresent()) {
            return handleExistingPayment(order, existingPayment.get(), amountCent, payerId);
        }
        if (order.getStatus() != OrderStatus.PENDING_PAYMENT) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                    "Order status does not allow payment: " + order.getStatus());
        }

        OrderStatus fromStatus = order.getStatus();
        OrderStatus targetStatus = OrderStatus.PAID_PENDING_SHOOT;
        ensureCanChangeStatus(fromStatus, targetStatus);

        order.setEscrowStatus(EscrowStatus.HELD);
        PaymentRecord paymentRecord = buildMockPaymentRecord(order, payerId, amountCent);
        try {
            paymentRecordRepository.saveAndFlush(paymentRecord);
        } catch (DataIntegrityViolationException ex) {
            throw new BusinessException(ErrorCode.DUPLICATE_OPERATION,
                    "Payment already exists for order: " + orderId);
        }

        Order paidOrder = applyStatusChange(order, fromStatus, targetStatus, payerId, "CUSTOMER", "模拟支付成功，资金进入平台托管");
        notifyOrderPaid(paidOrder);
        return paidOrder;
    }

    @Transactional
    public Order changeStatus(Long orderId, Long operatorId, OrderStatus targetStatus, String reason) {
        Order order = getOrderOrThrow(orderId);
        OrderStatus fromStatus = order.getStatus();
        ensureCanChangeStatus(fromStatus, targetStatus);
        ensureNotManualShootingTransition(fromStatus, targetStatus);
        if (targetStatus == OrderStatus.COMPLETED) {
            markCompletedAndReleaseEscrow(order, LocalDateTime.now(), false);
        } else if (targetStatus == OrderStatus.CANCELLED) {
            order.setCancelTime(LocalDateTime.now());
        }
        Order changedOrder = applyStatusChange(order, fromStatus, targetStatus, operatorId,
                resolveOperatorRole(order, operatorId), reason);
        if (targetStatus == OrderStatus.CANCELLED) {
            notifyOrderCancelled(changedOrder);
        } else if (targetStatus == OrderStatus.COMPLETED) {
            notifyOrderCompleted(changedOrder);
        }
        return changedOrder;
    }

    @Transactional
    public Order cancelOrder(Long orderId, Long customerId, String reason) {
        return cancelOrder(orderId, customerId, reason, LocalDateTime.now());
    }

    @Transactional
    public Order cancelOrder(Long orderId, Long customerId, String reason, LocalDateTime now) {
        Order order = getOrderOrThrow(orderId);
        if (!Objects.equals(order.getCustomerId(), customerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only the customer can cancel this order");
        }
        if (order.getStatus() == OrderStatus.PENDING_PAYMENT) {
            ensureCanChangeStatus(OrderStatus.PENDING_PAYMENT, OrderStatus.CANCELLED);
            order.setCancelTime(now);
            Order cancelledOrder = applyStatusChange(
                    order,
                    OrderStatus.PENDING_PAYMENT,
                    OrderStatus.CANCELLED,
                    customerId,
                    "CUSTOMER",
                    cancelReason(reason, "客户取消未支付订单")
            );
            notifyOrderCancelled(cancelledOrder);
            return cancelledOrder;
        }
        if (order.getStatus() == OrderStatus.PAID_PENDING_SHOOT) {
            if (order.getShootStartTime() == null || !now.isBefore(order.getShootStartTime())) {
                throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                        "Paid orders can only be cancelled before shoot start time");
            }
            ensureCanChangeStatus(OrderStatus.PAID_PENDING_SHOOT, OrderStatus.REFUNDED);
            order.setCancelTime(now);
            markRefunded(order, now);
            Order refundedOrder = applyStatusChange(
                    order,
                    OrderStatus.PAID_PENDING_SHOOT,
                    OrderStatus.REFUNDED,
                    customerId,
                    "CUSTOMER",
                    cancelReason(reason, "客户拍摄前取消，托管款原路退回")
            );
            notifyOrderCancelled(refundedOrder);
            return refundedOrder;
        }
        throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                "Order status does not allow cancellation: " + order.getStatus());
    }

    @Transactional
    public Order requestRework(Long orderId, Long customerId, String reason) {
        Order order = getOrderOrThrow(orderId);
        if (!Objects.equals(order.getCustomerId(), customerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only the customer can request rework");
        }
        if (order.getStatus() != OrderStatus.DELIVERED_PENDING_CONFIRM) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                    "Only delivered orders pending confirmation can request rework");
        }
        OrderStatus fromStatus = order.getStatus();
        OrderStatus targetStatus = OrderStatus.REWORK_REQUIRED;
        ensureCanChangeStatus(fromStatus, targetStatus);
        Order reworkOrder = applyStatusChange(order, fromStatus, targetStatus, customerId, "CUSTOMER", reworkReason(reason));
        notifyReworkRequired(reworkOrder);
        return reworkOrder;
    }

    @Transactional
    public Order completeReworkDelivery(Long orderId, Long providerId, String reason) {
        Order order = getOrderOrThrow(orderId);
        if (!Objects.equals(order.getProviderUserId(), providerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only the provider can upload rework delivery");
        }
        if (order.getStatus() != OrderStatus.REWORK_REQUIRED) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                    "Only rework required orders can complete rework delivery");
        }
        ensureCanChangeStatus(OrderStatus.REWORK_REQUIRED, OrderStatus.PENDING_DELIVERY);
        Order pendingDelivery = applyStatusChange(
                order,
                OrderStatus.REWORK_REQUIRED,
                OrderStatus.PENDING_DELIVERY,
                providerId,
                "PROVIDER",
                "服务方开始返修交付"
        );
        ensureCanChangeStatus(OrderStatus.PENDING_DELIVERY, OrderStatus.DELIVERED_PENDING_CONFIRM);
        return applyStatusChange(
                pendingDelivery,
                OrderStatus.PENDING_DELIVERY,
                OrderStatus.DELIVERED_PENDING_CONFIRM,
                providerId,
                "PROVIDER",
                reason
        );
    }

    @Transactional
    public Order markDeliveryUploaded(Long orderId, Long providerId, String reason) {
        Order order = getOrderOrThrow(orderId);
        if (!Objects.equals(order.getProviderUserId(), providerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only the provider can upload delivery");
        }
        if (order.getStatus() != OrderStatus.PENDING_DELIVERY) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                    "Only pending delivery orders can be marked as delivered");
        }
        ensureCanChangeStatus(OrderStatus.PENDING_DELIVERY, OrderStatus.DELIVERED_PENDING_CONFIRM);
        return applyStatusChange(
                order,
                OrderStatus.PENDING_DELIVERY,
                OrderStatus.DELIVERED_PENDING_CONFIRM,
                providerId,
                "PROVIDER",
                reason
        );
    }

    @Transactional
    public Order refundOrderFromDispute(Long orderId, Long adminId, Long refundAmountCent,
                                        boolean partialRefund, String reason) {
        Order order = getOrderForUpdateOrThrow(orderId);
        OrderStatus fromStatus = order.getStatus();
        ensureCanChangeStatus(fromStatus, OrderStatus.REFUNDED);
        LocalDateTime now = LocalDateTime.now();
        Long normalizedRefundAmount = normalizeDisputeRefundAmount(order, refundAmountCent, partialRefund);
        markRefunded(
                order,
                now,
                normalizedRefundAmount,
                partialRefund ? REFUND_PARTIAL_SUCCESS : REFUND_SUCCESS
        );
        return applyStatusChange(
                order,
                fromStatus,
                OrderStatus.REFUNDED,
                adminId,
                "ADMIN",
                reason
        );
    }

    @Transactional
    public Order restoreOrderAfterRejectedDispute(Long orderId, Long adminId,
                                                   OrderStatus previousStatus, String reason) {
        if (!DISPUTE_RESTORABLE_STATUSES.contains(previousStatus)) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                    "Dispute cannot restore order to status: " + previousStatus);
        }
        Order order = getOrderForUpdateOrThrow(orderId);
        if (order.getStatus() != OrderStatus.APPEALING) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                    "Only appealing orders can be restored after a rejected dispute");
        }
        ensureCanChangeStatus(OrderStatus.APPEALING, previousStatus);
        return applyStatusChange(
                order,
                OrderStatus.APPEALING,
                previousStatus,
                adminId,
                "ADMIN",
                reason
        );
    }

    @Transactional
    public Order completeOrderFromDispute(Long orderId, Long adminId, String reason) {
        Order order = getOrderForUpdateOrThrow(orderId);
        if (order.getStatus() != OrderStatus.APPEALING) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                    "Only appealing orders can be completed by dispute arbitration");
        }
        ensureCanChangeStatus(OrderStatus.APPEALING, OrderStatus.COMPLETED);
        markCompletedAndReleaseEscrow(order, LocalDateTime.now(), false);
        Order completedOrder = applyStatusChange(
                order,
                OrderStatus.APPEALING,
                OrderStatus.COMPLETED,
                adminId,
                "ADMIN",
                reason
        );
        notifyOrderCompleted(completedOrder);
        return completedOrder;
    }

    @Transactional
    public int autoConfirmTimeoutOrders(LocalDateTime now) {
        if (now == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "now must not be null");
        }
        LocalDateTime timeoutBoundary = now.minusDays(7);
        int confirmedCount = 0;
        for (Order candidate : orderRepository.findByStatus(OrderStatus.DELIVERED_PENDING_CONFIRM)) {
            Optional<Order> lockedOrder = orderRepository.findByIdForUpdate(candidate.getId());
            if (lockedOrder.isEmpty()) {
                continue;
            }
            Order order = lockedOrder.get();
            if (order.getStatus() != OrderStatus.DELIVERED_PENDING_CONFIRM) {
                continue;
            }
            Optional<OrderStatusLog> latestDeliveredLog =
                    orderStatusLogRepository.findFirstByOrderIdAndToStatusOrderByCreatedAtDesc(
                            order.getId(),
                            OrderStatus.DELIVERED_PENDING_CONFIRM
                    );
            if (latestDeliveredLog.isEmpty()) {
                continue;
            }
            LocalDateTime deliveredAt = latestDeliveredLog.get().getCreatedAt();
            if (deliveredAt == null || deliveredAt.isAfter(timeoutBoundary)) {
                continue;
            }
            ensureCanChangeStatus(order.getStatus(), OrderStatus.COMPLETED);
            markCompletedAndReleaseEscrow(order, now, true);
            Order completedOrder = applyStatusChange(
                    order,
                    OrderStatus.DELIVERED_PENDING_CONFIRM,
                    OrderStatus.COMPLETED,
                    null,
                    SYSTEM_OPERATOR_ROLE,
                    AUTO_CONFIRM_REASON
            );
            notifyOrderCompleted(completedOrder);
            confirmedCount++;
        }
        return confirmedCount;
    }

    @Transactional
    public int autoAdvanceShootingOrders(LocalDateTime now) {
        if (now == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "now must not be null");
        }
        int advancedCount = 0;
        for (Order candidate : orderRepository.findByStatus(OrderStatus.PAID_PENDING_SHOOT)) {
            Optional<Order> lockedOrder = orderRepository.findByIdForUpdate(candidate.getId());
            if (lockedOrder.isEmpty()) {
                continue;
            }
            advancedCount += syncTimelineStatusIfDue(lockedOrder.get(), now);
        }
        for (Order candidate : orderRepository.findByStatus(OrderStatus.SHOOTING)) {
            Optional<Order> lockedOrder = orderRepository.findByIdForUpdate(candidate.getId());
            if (lockedOrder.isEmpty()) {
                continue;
            }
            advancedCount += syncTimelineStatusIfDue(lockedOrder.get(), now);
        }
        return advancedCount;
    }

    @Transactional
    public Order syncTimelineStatusIfDue(Long orderId) {
        return syncTimelineStatusIfDue(orderId, LocalDateTime.now());
    }

    @Transactional
    public Order syncTimelineStatusIfDue(Long orderId, LocalDateTime now) {
        if (orderId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "orderId must not be null");
        }
        if (now == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "now must not be null");
        }
        Order order = orderRepository.findByIdForUpdate(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order not found: " + orderId));
        syncTimelineStatusIfDue(order, now);
        return order;
    }

    @Transactional
    public int autoRefundOverdueUndeliveredOrders(LocalDateTime now) {
        if (now == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "now must not be null");
        }
        int refundedCount = 0;
        for (Order candidate : orderRepository.findByStatus(OrderStatus.PENDING_DELIVERY)) {
            Optional<Order> lockedOrder = orderRepository.findByIdForUpdate(candidate.getId());
            if (lockedOrder.isEmpty()) {
                continue;
            }
            Order order = lockedOrder.get();
            if (order.getStatus() != OrderStatus.PENDING_DELIVERY
                    || order.getDeliveryDeadline() == null
                    || !now.isAfter(order.getDeliveryDeadline())) {
                continue;
            }
            if (deliveryRepository.existsByOrderId(order.getId())) {
                continue;
            }
            ensureCanChangeStatus(OrderStatus.PENDING_DELIVERY, OrderStatus.REFUNDED);
            markRefunded(order, now);
            Order refundedOrder = applyStatusChange(
                    order,
                    OrderStatus.PENDING_DELIVERY,
                    OrderStatus.REFUNDED,
                    null,
                    SYSTEM_OPERATOR_ROLE,
                    AUTO_REFUND_UNDELIVERED_REASON
            );
            notifyOrderCancelled(refundedOrder);
            refundedCount++;
        }
        return refundedCount;
    }

    @Transactional
    public List<Order> listMyOrders(Long operatorId, String role, OrderStatus status) {
        if (operatorId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "operatorId must not be null");
        }
        LocalDateTime now = LocalDateTime.now();
        if ("customer".equalsIgnoreCase(role)) {
            return filterAndSortOrders(
                    syncTimelineStatusesIfDue(listCustomerOrders(operatorId, null), now),
                    status
            );
        }
        if ("provider".equalsIgnoreCase(role)) {
            return filterAndSortOrders(
                    syncTimelineStatusesIfDue(listProviderOrders(operatorId, null), now),
                    status
            );
        }
        if (role != null && !role.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unsupported order role: " + role);
        }

        List<Order> orders = new ArrayList<>();
        orders.addAll(listCustomerOrders(operatorId, null));
        orders.addAll(listProviderOrders(operatorId, null));
        return filterAndSortOrders(syncTimelineStatusesIfDue(orders, now), status);
    }

    @Transactional
    public Order getOrderForUser(Long orderId, Long operatorId) {
        Order order = getOrderOrThrow(orderId);
        ensureOrderParticipant(order, operatorId);
        return syncTimelineStatusIfDueIfNeeded(order, LocalDateTime.now());
    }

    @Transactional(readOnly = true)
    public Order validateCompletedProviderOrder(Long orderId, Long providerId) {
        Order order = getOrderOrThrow(orderId);
        if (!Objects.equals(order.getProviderUserId(), providerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only order provider can use this completed order");
        }
        if (order.getStatus() != OrderStatus.COMPLETED) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "Only completed order can be used as portfolio source");
        }
        return order;
    }

    @Transactional(readOnly = true)
    public void ensureProviderTimeAvailable(Long providerUserId, LocalDateTime shootStartTime, LocalDateTime shootEndTime) {
        if (providerUserId == null || shootStartTime == null || shootEndTime == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "providerUserId, shootStartTime and shootEndTime must not be null");
        }
        if (!shootStartTime.isBefore(shootEndTime)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "shootStartTime must be before shootEndTime");
        }
        if (orderRepository.existsProviderTimeConflict(
                providerUserId,
                shootStartTime,
                shootEndTime,
                PROVIDER_TIME_CONFLICT_STATUSES)) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                    "Provider already has an active order in this shoot time range");
        }
    }

    @Transactional
    public List<OrderStatusLog> listStatusLogs(Long orderId, Long operatorId) {
        Order order = getOrderForUser(orderId, operatorId);
        return orderStatusLogRepository.findByOrderIdOrderByCreatedAtAsc(order.getId());
    }

    @Transactional
    public PaymentRecord getPaymentRecordForOrder(Long orderId, Long operatorId) {
        Order order = getOrderForUser(orderId, operatorId);
        return paymentRecordRepository.findByOrderId(order.getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND,
                        "Payment record not found for order: " + orderId));
    }

    @Transactional(readOnly = true)
    public OrderStatusLog getLatestStatusLog(Long orderId, Long operatorId) {
        List<OrderStatusLog> logs = listStatusLogs(orderId, operatorId);
        if (logs.isEmpty()) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Order status log not found for order: " + orderId);
        }
        return logs.get(logs.size() - 1);
    }

    private Order getOrderOrThrow(Long orderId) {
        if (orderId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "orderId must not be null");
        }
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order not found: " + orderId));
    }

    private Order getOrderForUpdateOrThrow(Long orderId) {
        if (orderId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "orderId must not be null");
        }
        return orderRepository.findByIdForUpdate(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order not found: " + orderId));
    }

    private List<Order> listCustomerOrders(Long customerId, OrderStatus status) {
        if (status == null) {
            return orderRepository.findByCustomerIdOrderByUpdatedAtDesc(customerId);
        }
        return orderRepository.findByCustomerIdAndStatusOrderByUpdatedAtDesc(customerId, status);
    }

    private List<Order> listProviderOrders(Long providerUserId, OrderStatus status) {
        if (status == null) {
            return orderRepository.findByProviderUserIdOrderByUpdatedAtDesc(providerUserId);
        }
        return orderRepository.findByProviderUserIdAndStatusOrderByUpdatedAtDesc(providerUserId, status);
    }

    private List<Order> syncTimelineStatusesIfDue(List<Order> orders, LocalDateTime now) {
        return orders.stream()
                .map(order -> syncTimelineStatusIfDueIfNeeded(order, now))
                .toList();
    }

    private List<Order> filterAndSortOrders(List<Order> orders, OrderStatus status) {
        List<Order> sortedOrders = new ArrayList<>(orders.stream()
                .filter(order -> status == null || order.getStatus() == status)
                .toList());
        sortedOrders.sort(Comparator.comparing(Order::getUpdatedAt,
                Comparator.nullsLast(Comparator.reverseOrder())));
        return sortedOrders;
    }

    private Order syncTimelineStatusIfDueIfNeeded(Order order, LocalDateTime now) {
        if (!isTimelineSyncDue(order, now)) {
            return order;
        }
        return syncTimelineStatusIfDue(order.getId(), now);
    }

    private boolean isTimelineSyncDue(Order order, LocalDateTime now) {
        if (order == null || now == null) {
            return false;
        }
        if (order.getStatus() == OrderStatus.PAID_PENDING_SHOOT) {
            return order.getShootStartTime() != null && !order.getShootStartTime().isAfter(now);
        }
        if (order.getStatus() == OrderStatus.SHOOTING) {
            return order.getShootEndTime() != null && !order.getShootEndTime().isAfter(now);
        }
        return false;
    }

    private int syncTimelineStatusIfDue(Order order, LocalDateTime now) {
        int advancedCount = 0;
        if (order == null || now == null) {
            return advancedCount;
        }
        if (order.getStatus() == OrderStatus.PAID_PENDING_SHOOT
                && order.getShootStartTime() != null
                && !order.getShootStartTime().isAfter(now)) {
            ensureCanChangeStatus(OrderStatus.PAID_PENDING_SHOOT, OrderStatus.SHOOTING);
            order = applyStatusChange(
                    order,
                    OrderStatus.PAID_PENDING_SHOOT,
                    OrderStatus.SHOOTING,
                    null,
                    SYSTEM_OPERATOR_ROLE,
                    AUTO_SHOOTING_START_REASON
            );
            notifyOrderShootingStarted(order);
            advancedCount++;
        }
        if (order.getStatus() == OrderStatus.SHOOTING
                && order.getShootEndTime() != null
                && !order.getShootEndTime().isAfter(now)) {
            ensureCanChangeStatus(OrderStatus.SHOOTING, OrderStatus.PENDING_DELIVERY);
            order = applyStatusChange(
                    order,
                    OrderStatus.SHOOTING,
                    OrderStatus.PENDING_DELIVERY,
                    null,
                    SYSTEM_OPERATOR_ROLE,
                    AUTO_SHOOTING_END_REASON
            );
            notifyOrderPendingDelivery(order);
            advancedCount++;
        }
        return advancedCount;
    }

    private void ensureOrderParticipant(Order order, Long operatorId) {
        if (operatorId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "operatorId must not be null");
        }
        if (!Objects.equals(order.getCustomerId(), operatorId)
                && !Objects.equals(order.getProviderUserId(), operatorId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only order participants can operate this order");
        }
    }

    private void validateConfirmedQuote(Quote quote) {
        if (quote == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "quote must not be null");
        }
        if (quote.getId() == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "quoteId must not be null");
        }
        if (quote.getStatus() != QuoteStatus.CONFIRMED) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                    "Only confirmed quote can generate order: " + quote.getStatus());
        }
        if (quote.getAmountCent() == null || quote.getAmountCent() <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "quote amount must be positive");
        }
    }

    private void bindServicePackageConversationToOrder(Order order) {
        if (conversationRepository == null
                || order == null
                || order.getId() == null
                || order.getConversationId() == null
                || !SOURCE_TYPE_SERVICE_PACKAGE.equals(order.getSourceType())) {
            return;
        }
        conversationRepository.findById(order.getConversationId())
                .filter(conversation -> Objects.equals(conversation.getSourceType(), ConversationService.SOURCE_TYPE_SERVICE_PACKAGE))
                .filter(conversation -> Objects.equals(conversation.getSourceId(), order.getServicePackageId()))
                .filter(conversation -> Objects.equals(conversation.getParticipantAId(), order.getCustomerId()))
                .filter(conversation -> Objects.equals(conversation.getParticipantBId(), order.getProviderUserId()))
                .filter(conversation -> conversation.getOrderId() == null
                        || Objects.equals(conversation.getOrderId(), ConversationService.PENDING_ORDER_ID)
                        || Objects.equals(conversation.getOrderId(), order.getId()))
                .ifPresent(conversation -> {
                    conversation.setOrderId(order.getId());
                    conversationRepository.save(conversation);
                });
    }

    private Order buildOrderFromQuote(Quote quote) {
        LocalDateTime now = LocalDateTime.now();
        Order order = new Order();
        order.setOrderNo("O" + DateTimeFormatter.ofPattern("yyyyMMddHHmmss").format(now) + quote.getId());
        order.setQuoteId(quote.getId());
        order.setConversationId(quote.getConversationId());
        order.setCustomerId(quote.getCustomerId());
        order.setProviderUserId(quote.getProviderUserId());
        order.setShootingPlanId(quote.getShootingPlanId());
        order.setSourceType(quote.getSourceType());
        order.setSourceId(quote.getSourceId());
        if (SOURCE_TYPE_SERVICE_PACKAGE.equals(quote.getSourceType())) {
            order.setServicePackageId(quote.getSourceId());
        }
        order.setStatus(OrderStatus.PENDING_PAYMENT);
        order.setEscrowStatus(EscrowStatus.NOT_PAID);
        order.setSettlementStatus(SETTLEMENT_NOT_SETTLED);
        order.setRefundStatus(REFUND_NONE);
        order.setTotalAmountCent(quote.getAmountCent());
        order.setPlatformFeeCent(0L);
        order.setProviderIncomeCent(quote.getAmountCent());
        order.setShootStartTime(quote.getShootStartTime());
        order.setShootEndTime(quote.getShootEndTime());
        order.setShootLocation(quote.getLocation());
        if (quote.getDeliveryDeadline() != null) {
            order.setDeliveryDeadline(quote.getDeliveryDeadline());
        } else if (quote.getShootEndTime() != null && quote.getDeliveryDays() != null) {
            order.setDeliveryDeadline(quote.getShootEndTime().plusDays(quote.getDeliveryDays()));
        }
        order.setPhotoUsageScope(quote.getPhotoUsageScope());
        order.setQuoteSnapshotJson(buildQuoteSnapshot(quote));
        order.setSafetyNoticeConfirmed(false);
        order.setContractTerms(quote.getContractTerms());
        order.setCreatedAt(now);
        order.setUpdatedAt(now);
        return order;
    }

    private PaymentRecord buildMockPaymentRecord(Order order, Long payerId, Long amountCent) {
        LocalDateTime now = LocalDateTime.now();
        PaymentRecord paymentRecord = new PaymentRecord();
        paymentRecord.setPaymentNo("P" + DateTimeFormatter.ofPattern("yyyyMMddHHmmss").format(now) + order.getId());
        paymentRecord.setOrderId(order.getId());
        paymentRecord.setPayerId(payerId);
        paymentRecord.setAmountCent(amountCent);
        paymentRecord.setRefundAmountCent(0L);
        paymentRecord.setPayMethod(MOCK_PAY_METHOD);
        paymentRecord.setStatus(PAYMENT_SUCCESS);
        paymentRecord.setRequestedAt(now);
        paymentRecord.setPaidAt(now);
        paymentRecord.setCreatedAt(now);
        return paymentRecord;
    }

    private Order handleExistingPayment(Order order, PaymentRecord existingPayment, Long amountCent, Long payerId) {
        ensurePaymentAmountMatches(existingPayment, amountCent);
        if (order.getStatus() == OrderStatus.PENDING_PAYMENT) {
            OrderStatus fromStatus = order.getStatus();
            ensureCanChangeStatus(fromStatus, OrderStatus.PAID_PENDING_SHOOT);
            order.setEscrowStatus(EscrowStatus.HELD);
            Order paidOrder = applyStatusChange(
                    order,
                    fromStatus,
                    OrderStatus.PAID_PENDING_SHOOT,
                    payerId,
                    "CUSTOMER",
                    "重复支付请求命中已有支付记录，补齐订单支付状态"
            );
            notifyOrderPaid(paidOrder);
            return paidOrder;
        }
        return order;
    }

    private void ensurePaymentAmountMatches(PaymentRecord paymentRecord, Long amountCent) {
        if (!Objects.equals(paymentRecord.getAmountCent(), amountCent)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Payment already exists with a different amount for order: " + paymentRecord.getOrderId());
        }
    }

    private void ensureCanChangeStatus(OrderStatus fromStatus, OrderStatus targetStatus) {
        if (!OrderStatusMachine.canTransit(fromStatus, targetStatus)) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                    "Illegal order status transition from " + fromStatus + " to " + targetStatus);
        }
    }

    private void ensureNotManualShootingTransition(OrderStatus fromStatus, OrderStatus targetStatus) {
        boolean startsShooting = fromStatus == OrderStatus.PAID_PENDING_SHOOT
                && targetStatus == OrderStatus.SHOOTING;
        boolean finishesShooting = fromStatus == OrderStatus.SHOOTING
                && targetStatus == OrderStatus.PENDING_DELIVERY;
        if (startsShooting || finishesShooting) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                    "Shooting status is advanced by the system schedule, not manually");
        }
    }

    private Order applyStatusChange(Order order, OrderStatus fromStatus, OrderStatus targetStatus,
                                    Long operatorId, String operatorRole, String reason) {
        LocalDateTime now = LocalDateTime.now();
        order.setStatus(targetStatus);
        order.setUpdatedAt(now);
        Order savedOrder = orderRepository.save(order);

        OrderStatusLog statusLog = new OrderStatusLog();
        statusLog.setOrderId(savedOrder.getId());
        statusLog.setFromStatus(fromStatus);
        statusLog.setToStatus(targetStatus);
        statusLog.setOperatorId(operatorId);
        statusLog.setOperatorRole(operatorRole);
        statusLog.setReason(reason);
        statusLog.setCreatedAt(now);
        orderStatusLogRepository.save(statusLog);

        return savedOrder;
    }

    private void markCompletedAndReleaseEscrow(Order order, LocalDateTime completedAt, boolean autoConfirmed) {
        order.setEscrowStatus(EscrowStatus.RELEASED);
        order.setSettlementStatus(SETTLEMENT_SETTLED);
        order.setCompleteTime(completedAt);
        if (autoConfirmed) {
            order.setAutoConfirmTime(completedAt);
        }
    }

    private void markRefunded(Order order, LocalDateTime refundedAt) {
        markRefunded(order, refundedAt, order.getTotalAmountCent(), REFUND_SUCCESS);
    }

    private void markRefunded(Order order, LocalDateTime refundedAt, Long refundAmountCent, String refundStatus) {
        Long normalizedRefundAmount = refundAmountCent == null ? order.getTotalAmountCent() : refundAmountCent;
        order.setEscrowStatus(EscrowStatus.REFUNDED);
        order.setSettlementStatus(SETTLEMENT_NOT_SETTLED);
        order.setRefundStatus(refundStatus);
        paymentRecordRepository.findByOrderId(order.getId()).ifPresent(paymentRecord -> {
            paymentRecord.setRefundAmountCent(normalizedRefundAmount);
            paymentRecord.setRefundedAt(refundedAt);
            paymentRecord.setStatus(Objects.equals(normalizedRefundAmount, order.getTotalAmountCent())
                    ? PAYMENT_REFUNDED
                    : PAYMENT_PARTIAL_REFUNDED);
            paymentRecordRepository.save(paymentRecord);
        });
    }

    private Long normalizeDisputeRefundAmount(Order order, Long refundAmountCent, boolean partialRefund) {
        Long totalAmount = order.getTotalAmountCent();
        if (!partialRefund) {
            return totalAmount;
        }
        if (refundAmountCent == null || refundAmountCent <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Partial refund amount must be positive");
        }
        if (totalAmount != null && refundAmountCent > totalAmount) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Partial refund amount exceeds order amount");
        }
        return refundAmountCent;
    }

    private String cancelReason(String reason, String defaultReason) {
        if (reason == null || reason.isBlank()) {
            return defaultReason;
        }
        return reason.trim();
    }

    private String resolveOperatorRole(Order order, Long operatorId) {
        if (UserContext.isAdmin()) {
            return "ADMIN";
        }
        UserRole contextRole = UserContext.getCurrentRole();
        if (contextRole != null) {
            return contextRole.name();
        }
        if (Objects.equals(order.getCustomerId(), operatorId)) {
            return "CUSTOMER";
        }
        if (Objects.equals(order.getProviderUserId(), operatorId)) {
            return "PROVIDER";
        }
        return "SYSTEM";
    }

    private String reworkReason(String reason) {
        if (reason == null || reason.isBlank()) {
            return "需求方请求返修";
        }
        String trimmedReason = reason.trim();
        if (trimmedReason.length() > REWORK_REASON_MAX_LENGTH) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Rework reason must not exceed " + REWORK_REASON_MAX_LENGTH + " characters");
        }
        return "需求方请求返修：" + trimmedReason;
    }

    private String buildQuoteSnapshot(Quote quote) {
        return "{"
                + "\"quoteId\":" + quote.getId()
                + ",\"amountCent\":" + quote.getAmountCent()
                + ",\"location\":\"" + escape(quote.getLocation()) + "\""
                + ",\"serviceContent\":\"" + escape(quote.getServiceContent()) + "\""
                + ",\"originalCount\":" + quote.getOriginalCount()
                + ",\"refinedCount\":" + quote.getRefinedCount()
                + ",\"deliveryDays\":" + quote.getDeliveryDays()
                + ",\"photoUsageScope\":\"" + escape(quote.getPhotoUsageScope()) + "\""
                + ",\"remark\":\"" + escape(quote.getRemark()) + "\""
                + "}";
    }

    private String escape(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private void notifyOrderPaid(Order order) {
        String customerName = customerDisplayName(order);
        String providerName = providerDisplayName(order);
        String orderSubject = orderDisplayService.resolveOrderSubject(order);
        createNotification(order.getProviderUserId(),
                orderSubject + " 已进入待拍摄",
                customerName + " 已完成支付，" + orderSubject + " 已进入待拍摄，请按约准备拍摄。",
                "ORDER_PAID",
                "ORDER",
                order.getId());
        createNotification(order.getCustomerId(),
                orderSubject + " 已进入待拍摄",
                "你已完成对 " + providerName + " 的支付，" + orderSubject + " 已进入待拍摄。",
                "ORDER_PAID",
                "ORDER",
                order.getId());
    }

    private void notifyOrderCancelled(Order order) {
        boolean refunded = order.getStatus() == OrderStatus.REFUNDED;
        String customerName = customerDisplayName(order);
        String providerName = providerDisplayName(order);
        String orderSubject = orderDisplayService.resolveOrderSubject(order);
        String title = orderSubject + (refunded ? " 已退款" : " 已取消");
        String providerContent = refunded
                ? customerName + " 发起的" + orderSubject + "已退款，本次合作已结束。"
                : customerName + " 已取消" + orderSubject + "，本次合作已结束。";
        String customerContent = refunded
                ? "你与 " + providerName + " 的" + orderSubject + "已退款。"
                : "你与 " + providerName + " 的" + orderSubject + "已取消。";
        createNotification(order.getProviderUserId(), title, providerContent, refunded ? "ORDER_REFUNDED" : "ORDER_CANCELLED", "ORDER", order.getId());
        createNotification(order.getCustomerId(), title, customerContent, refunded ? "ORDER_REFUNDED" : "ORDER_CANCELLED", "ORDER", order.getId());
    }

    private void notifyOrderCompleted(Order order) {
        String customerName = customerDisplayName(order);
        String providerName = providerDisplayName(order);
        String orderSubject = orderDisplayService.resolveOrderSubject(order);
        createNotification(order.getProviderUserId(),
                orderSubject + " 已完成",
                customerName + " 已确认" + orderSubject + "完成，本次合作已结束。",
                "ORDER_COMPLETED",
                "ORDER",
                order.getId());
        createNotification(order.getCustomerId(),
                orderSubject + " 已完成",
                "你与 " + providerName + " 的" + orderSubject + "已完成。",
                "ORDER_COMPLETED",
                "ORDER",
                order.getId());
    }

    private void notifyOrderShootingStarted(Order order) {
        String orderSubject = orderDisplayService.resolveOrderSubject(order);
        createNotification(order.getCustomerId(),
                orderSubject + " 已开始拍摄",
                orderSubject + " 已进入拍摄中，可前往订单详情查看当前进展。",
                "ORDER_SHOOTING_STARTED",
                "ORDER",
                order.getId());
        createNotification(order.getProviderUserId(),
                orderSubject + " 已开始拍摄",
                orderSubject + " 已进入拍摄中，请按约完成本次拍摄。",
                "ORDER_SHOOTING_STARTED",
                "ORDER",
                order.getId());
    }

    private void notifyOrderPendingDelivery(Order order) {
        String orderSubject = orderDisplayService.resolveOrderSubject(order);
        createNotification(order.getCustomerId(),
                orderSubject + " 已进入待交付",
                orderSubject + " 的拍摄已结束，正在等待摄影师上传作品。",
                "ORDER_PENDING_DELIVERY",
                "ORDER",
                order.getId());
        createNotification(order.getProviderUserId(),
                orderSubject + " 已进入待交付",
                orderSubject + " 的拍摄已结束，请尽快上传作品。",
                "ORDER_PENDING_DELIVERY",
                "ORDER",
                order.getId());
    }

    private void notifyReworkRequired(Order order) {
        String customerName = customerDisplayName(order);
        String orderSubject = orderDisplayService.resolveOrderSubject(order);
        createNotification(order.getProviderUserId(),
                orderSubject + " 收到返修要求",
                customerName + " 针对" + orderSubject + "提交了返修说明，请前往订单详情处理。",
                "ORDER_REWORK_REQUIRED",
                "ORDER",
                order.getId());
        createNotification(order.getCustomerId(),
                orderSubject + " 已进入返修中",
                "你已针对" + orderSubject + "提交返修要求，等待摄影师重新上传作品。",
                "ORDER_REWORK_REQUIRED",
                "ORDER",
                order.getId());
    }

    private void createNotification(Long userId, String title, String content, String type,
                                    String relatedType, Long relatedId) {
        if (notificationService == null) {
            return;
        }
        notificationService.createNotification(new NotificationCreateRequest(
                userId,
                title,
                content,
                type,
                relatedType,
                relatedId
        ));
    }

    private String customerDisplayName(Order order) {
        return userDisplayService.resolveCustomerDisplayName(order.getCustomerId());
    }

    private String providerDisplayName(Order order) {
        return userDisplayService.resolveProviderDisplayName(order.getProviderUserId());
    }
}
