package com.action.camera.delivery.adapter;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.delivery.port.OrderQueryPort;
import com.action.camera.delivery.port.OrderSnapshot;
import com.action.camera.delivery.port.OrderStatusPort;
import com.action.camera.order.entity.Order;
import com.action.camera.order.enums.OrderStatus;
import com.action.camera.order.service.OrderService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "camera.order.adapter", havingValue = "local")
public class LocalOrderAdapter implements OrderQueryPort, OrderStatusPort {

    private final OrderService orderService;

    public LocalOrderAdapter(OrderService orderService) {
        this.orderService = orderService;
    }

    @Override
    public OrderSnapshot getOrderSnapshot(Long orderId) {
        Long currentUserId = currentUserId();
        Order order = orderService.getOrderForUser(orderId, currentUserId);
        return new OrderSnapshot(
                order.getId(),
                order.getCustomerId(),
                order.getProviderUserId(),
                order.getStatus().name(),
                order.getRefundStatus(),
                order.getDeliveryDeadline()
        );
    }

    @Override
    public String changeStatus(Long orderId, String targetStatus, Long operatorId, String remark) {
        OrderStatus status = parseStatus(targetStatus);
        Order order = orderService.changeStatus(orderId, operatorId, status, remark);
        return order.getStatus().name();
    }

    private Long currentUserId() {
        Long userId = UserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return userId;
    }

    private OrderStatus parseStatus(String targetStatus) {
        try {
            return OrderStatus.valueOf(targetStatus);
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unsupported order status: " + targetStatus);
        }
    }
}
