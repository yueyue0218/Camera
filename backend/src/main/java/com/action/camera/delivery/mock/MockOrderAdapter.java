package com.action.camera.delivery.mock;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.delivery.port.OrderQueryPort;
import com.action.camera.delivery.port.OrderSnapshot;
import com.action.camera.delivery.port.OrderStatusPort;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@ConditionalOnProperty(name = "camera.order.adapter", havingValue = "mock", matchIfMissing = true)
public class MockOrderAdapter implements OrderQueryPort, OrderStatusPort {

    private static final Long MOCK_DELIVERY_ORDER_ID = 8001L;
    private static final Long MOCK_COMPLETED_ORDER_ID = 8002L;
    private static final Long MOCK_PROVIDER_FAULT_REFUNDED_ORDER_ID = 8003L;
    private static final Long MOCK_CUSTOMER_FAULT_REFUNDED_ORDER_ID = 8004L;
    private static final Long MOCK_BOTH_FAULT_REFUNDED_ORDER_ID = 8005L;
    private static final Long MOCK_MUTUAL_REFUNDED_ORDER_ID = 8006L;
    private static final Long MOCK_UNDETERMINED_REFUNDED_ORDER_ID = 8007L;
    private static final Long MOCK_CUSTOMER_ID = 1001L;
    private static final Long MOCK_PROVIDER_ID = 2001L;
    private static final String PENDING_DELIVERY = "PENDING_DELIVERY";
    private static final String DELIVERED_PENDING_CONFIRM = "DELIVERED_PENDING_CONFIRM";
    private static final String COMPLETED = "COMPLETED";
    private static final String REFUNDED = "REFUNDED";

    @Override
    public OrderSnapshot getOrderSnapshot(Long orderId) {
        if (MOCK_DELIVERY_ORDER_ID.equals(orderId)) {
            return snapshot(MOCK_DELIVERY_ORDER_ID, PENDING_DELIVERY, "NONE", LocalDateTime.now().plusDays(7));
        }
        if (MOCK_COMPLETED_ORDER_ID.equals(orderId)) {
            return snapshot(MOCK_COMPLETED_ORDER_ID, COMPLETED, "NONE", LocalDateTime.now().minusDays(1));
        }
        if (MOCK_PROVIDER_FAULT_REFUNDED_ORDER_ID.equals(orderId)) {
            return snapshot(MOCK_PROVIDER_FAULT_REFUNDED_ORDER_ID, REFUNDED, "PROVIDER_FAULT", LocalDateTime.now().minusDays(1));
        }
        if (MOCK_CUSTOMER_FAULT_REFUNDED_ORDER_ID.equals(orderId)) {
            return snapshot(MOCK_CUSTOMER_FAULT_REFUNDED_ORDER_ID, REFUNDED, "CUSTOMER_FAULT", LocalDateTime.now().minusDays(1));
        }
        if (MOCK_BOTH_FAULT_REFUNDED_ORDER_ID.equals(orderId)) {
            return snapshot(MOCK_BOTH_FAULT_REFUNDED_ORDER_ID, REFUNDED, "BOTH_FAULT", LocalDateTime.now().minusDays(1));
        }
        if (MOCK_MUTUAL_REFUNDED_ORDER_ID.equals(orderId)) {
            return snapshot(MOCK_MUTUAL_REFUNDED_ORDER_ID, REFUNDED, "MUTUAL_AGREEMENT", LocalDateTime.now().minusDays(1));
        }
        if (MOCK_UNDETERMINED_REFUNDED_ORDER_ID.equals(orderId)) {
            return snapshot(MOCK_UNDETERMINED_REFUNDED_ORDER_ID, REFUNDED, "UNDETERMINED", LocalDateTime.now().minusDays(1));
        }
        throw new BusinessException(ErrorCode.NOT_FOUND, "Order not found");
    }

    @Override
    public String changeStatus(Long orderId, String targetStatus, Long operatorId, String remark) {
        if (!MOCK_DELIVERY_ORDER_ID.equals(orderId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Order not found");
        }
        if (!DELIVERED_PENDING_CONFIRM.equals(targetStatus)) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "Target status is not allowed");
        }
        return DELIVERED_PENDING_CONFIRM;
    }

    private OrderSnapshot snapshot(Long orderId, String status, String refundStatus, LocalDateTime deliveryDeadline) {
        return new OrderSnapshot(
                orderId,
                MOCK_CUSTOMER_ID,
                MOCK_PROVIDER_ID,
                status,
                refundStatus,
                deliveryDeadline
        );
    }
}
