package com.action.camera.order.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.message.entity.Quote;
import com.action.camera.message.enums.QuoteStatus;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class OrderService {

    public static final String MOCK_PAY_METHOD = "MOCK_PAY";
    private static final int REWORK_REASON_MAX_LENGTH = 200;
    private static final String PAYMENT_SUCCESS = "SUCCESS";

    private final OrderRepository orderRepository;
    private final PaymentRecordRepository paymentRecordRepository;
    private final OrderStatusLogRepository orderStatusLogRepository;

    @Transactional
    public Order createOrderFromConfirmedQuote(Quote quote) {
        validateConfirmedQuote(quote);

        return orderRepository.findByQuoteId(quote.getId())
                .orElseGet(() -> orderRepository.save(buildOrderFromQuote(quote)));
    }

    @Transactional
    public Order mockPay(Long orderId, Long payerId, Long amountCent) {
        Order order = getOrderOrThrow(orderId);

        if (!Objects.equals(order.getCustomerId(), payerId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only the customer can pay this order");
        }
        if (order.getStatus() != OrderStatus.PENDING_PAYMENT) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                    "Order status does not allow payment: " + order.getStatus());
        }
        if (!Objects.equals(order.getTotalAmountCent(), amountCent)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Payment amount does not match order amount");
        }
        if (paymentRecordRepository.findByOrderId(order.getId()).isPresent()) {
            throw new BusinessException(ErrorCode.DUPLICATE_OPERATION,
                    "Payment already exists for order: " + order.getId());
        }

        OrderStatus fromStatus = order.getStatus();
        OrderStatus targetStatus = OrderStatus.PAID_PENDING_SHOOT;
        ensureCanChangeStatus(fromStatus, targetStatus);

        order.setEscrowStatus(EscrowStatus.HELD);
        PaymentRecord paymentRecord = buildMockPaymentRecord(order, payerId, amountCent);
        paymentRecordRepository.save(paymentRecord);

        return applyStatusChange(order, fromStatus, targetStatus, payerId, "CUSTOMER", "模拟支付成功，资金进入平台托管");
    }

    @Transactional
    public Order changeStatus(Long orderId, Long operatorId, OrderStatus targetStatus, String reason) {
        Order order = getOrderOrThrow(orderId);
        OrderStatus fromStatus = order.getStatus();
        ensureCanChangeStatus(fromStatus, targetStatus);
        return applyStatusChange(order, fromStatus, targetStatus, operatorId, resolveOperatorRole(order, operatorId), reason);
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
        return applyStatusChange(order, fromStatus, targetStatus, customerId, "CUSTOMER", reworkReason(reason));
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

    @Transactional(readOnly = true)
    public List<Order> listMyOrders(Long operatorId, String role, OrderStatus status) {
        if (operatorId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "operatorId must not be null");
        }
        if ("customer".equalsIgnoreCase(role)) {
            return listCustomerOrders(operatorId, status);
        }
        if ("provider".equalsIgnoreCase(role)) {
            return listProviderOrders(operatorId, status);
        }
        if (role != null && !role.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unsupported order role: " + role);
        }

        List<Order> orders = new ArrayList<>();
        orders.addAll(listCustomerOrders(operatorId, status));
        orders.addAll(listProviderOrders(operatorId, status));
        orders.sort(Comparator.comparing(Order::getUpdatedAt,
                Comparator.nullsLast(Comparator.reverseOrder())));
        return orders;
    }

    @Transactional(readOnly = true)
    public Order getOrderForUser(Long orderId, Long operatorId) {
        Order order = getOrderOrThrow(orderId);
        ensureOrderParticipant(order, operatorId);
        return order;
    }

    @Transactional(readOnly = true)
    public List<OrderStatusLog> listStatusLogs(Long orderId, Long operatorId) {
        Order order = getOrderForUser(orderId, operatorId);
        return orderStatusLogRepository.findByOrderIdOrderByCreatedAtAsc(order.getId());
    }

    @Transactional(readOnly = true)
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
        order.setStatus(OrderStatus.PENDING_PAYMENT);
        order.setEscrowStatus(EscrowStatus.NOT_PAID);
        order.setSettlementStatus("NOT_SETTLED");
        order.setRefundStatus("NONE");
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

    private void ensureCanChangeStatus(OrderStatus fromStatus, OrderStatus targetStatus) {
        if (!OrderStatusMachine.canTransit(fromStatus, targetStatus)) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                    "Illegal order status transition from " + fromStatus + " to " + targetStatus);
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

    private String resolveOperatorRole(Order order, Long operatorId) {
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
}
