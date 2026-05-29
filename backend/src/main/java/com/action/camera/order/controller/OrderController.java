package com.action.camera.order.controller;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.Result;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.order.dto.MockPaymentRequest;
import com.action.camera.order.dto.OrderResponse;
import com.action.camera.order.dto.OrderStatusLogResponse;
import com.action.camera.order.dto.PaymentResponse;
import com.action.camera.order.dto.ReworkRequest;
import com.action.camera.order.dto.StatusTransitionRequest;
import com.action.camera.order.dto.StatusTransitionResponse;
import com.action.camera.order.entity.Order;
import com.action.camera.order.entity.OrderStatusLog;
import com.action.camera.order.entity.PaymentRecord;
import com.action.camera.order.enums.OrderStatus;
import com.action.camera.order.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Objects;

@RestController
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @GetMapping("/orders")
    public Result<List<OrderResponse>> listMyOrders(
            @RequestParam(required = false) String role,
            @RequestParam(required = false) OrderStatus status) {
        Long operatorId = currentUserId();
        List<OrderResponse> orders = orderService.listMyOrders(operatorId, role, status)
                .stream()
                .map(OrderResponse::from)
                .toList();
        return Result.success(orders);
    }

    @GetMapping("/orders/{orderId}")
    public Result<OrderResponse> getOrder(@PathVariable Long orderId) {
        Long operatorId = currentUserId();
        return Result.success(OrderResponse.from(orderService.getOrderForUser(orderId, operatorId)));
    }

    @PostMapping("/orders/{orderId}/payments")
    public Result<PaymentResponse> mockPay(
            @PathVariable Long orderId,
            @RequestBody MockPaymentRequest request) {
        Long operatorId = currentUserId();
        if (!OrderService.MOCK_PAY_METHOD.equals(request.getPayMethod())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "P4 only supports MOCK_PAY");
        }
        Order paidOrder = orderService.mockPay(orderId, operatorId, request.getAmountCent());
        PaymentRecord paymentRecord = orderService.getPaymentRecordForOrder(orderId, operatorId);
        return Result.success(PaymentResponse.from(paymentRecord, paidOrder));
    }

    @PostMapping("/orders/{orderId}/status-transitions")
    public Result<StatusTransitionResponse> changeStatus(
            @PathVariable Long orderId,
            @RequestBody StatusTransitionRequest request) {
        Long operatorId = currentUserId();
        Order order = orderService.getOrderForUser(orderId, operatorId);
        validateP4Transition(order, operatorId, request.getTargetStatus());
        orderService.changeStatus(orderId, operatorId, request.getTargetStatus(), request.getReason());
        OrderStatusLog latestLog = orderService.getLatestStatusLog(orderId, operatorId);
        return Result.success(StatusTransitionResponse.from(latestLog));
    }

    @PostMapping("/orders/{orderId}/request-rework")
    public Result<StatusTransitionResponse> requestRework(
            @PathVariable Long orderId,
            @RequestBody(required = false) ReworkRequest request) {
        Long operatorId = currentUserId();
        String reason = request == null ? null : request.getReason();
        orderService.requestRework(orderId, operatorId, reason);
        OrderStatusLog latestLog = orderService.getLatestStatusLog(orderId, operatorId);
        return Result.success(StatusTransitionResponse.from(latestLog));
    }

    @GetMapping("/orders/{orderId}/status-logs")
    public Result<List<OrderStatusLogResponse>> listStatusLogs(@PathVariable Long orderId) {
        Long operatorId = currentUserId();
        List<OrderStatusLogResponse> logs = orderService.listStatusLogs(orderId, operatorId)
                .stream()
                .map(OrderStatusLogResponse::from)
                .toList();
        return Result.success(logs);
    }

    private void validateP4Transition(Order order, Long operatorId, OrderStatus targetStatus) {
        if (targetStatus == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "targetStatus must not be null");
        }
        if (order.getStatus() == OrderStatus.PENDING_PAYMENT || targetStatus == OrderStatus.PAID_PENDING_SHOOT) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                    "PENDING_PAYMENT to PAID_PENDING_SHOOT must use mock payment API");
        }

        if (order.getStatus() == OrderStatus.PAID_PENDING_SHOOT && targetStatus == OrderStatus.SHOOTING) {
            ensureProvider(order, operatorId);
            return;
        }
        if (order.getStatus() == OrderStatus.SHOOTING && targetStatus == OrderStatus.PENDING_DELIVERY) {
            ensureProvider(order, operatorId);
            return;
        }
        if (order.getStatus() == OrderStatus.PENDING_DELIVERY
                && targetStatus == OrderStatus.DELIVERED_PENDING_CONFIRM) {
            ensureProvider(order, operatorId);
            return;
        }
        if (order.getStatus() == OrderStatus.DELIVERED_PENDING_CONFIRM && targetStatus == OrderStatus.COMPLETED) {
            ensureCustomer(order, operatorId);
            return;
        }
        if ((order.getStatus() == OrderStatus.PENDING_PAYMENT
                || order.getStatus() == OrderStatus.PAID_PENDING_SHOOT)
                && targetStatus == OrderStatus.CANCELLED) {
            ensureCustomer(order, operatorId);
            return;
        }

        throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                "This status transition is not exposed in P4 order API: "
                        + order.getStatus() + " -> " + targetStatus);
    }

    private void ensureProvider(Order order, Long operatorId) {
        if (!Objects.equals(order.getProviderUserId(), operatorId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only provider can operate this status transition");
        }
    }

    private void ensureCustomer(Order order, Long operatorId) {
        if (!Objects.equals(order.getCustomerId(), operatorId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only customer can operate this status transition");
        }
    }

    private Long currentUserId() {
        Long userId = UserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return userId;
    }
}
