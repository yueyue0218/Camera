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
    private static final Long MOCK_CUSTOMER_ID = 1001L;
    private static final Long MOCK_PROVIDER_ID = 2001L;
    private static final String PENDING_DELIVERY = "PENDING_DELIVERY";
    private static final String DELIVERED_PENDING_CONFIRM = "DELIVERED_PENDING_CONFIRM";
    private static final String COMPLETED = "COMPLETED";

    @Override
    public OrderSnapshot getOrderSnapshot(Long orderId) {
        if (MOCK_DELIVERY_ORDER_ID.equals(orderId)) {
            return new OrderSnapshot(
                    MOCK_DELIVERY_ORDER_ID,
                    MOCK_CUSTOMER_ID,
                    MOCK_PROVIDER_ID,
                    PENDING_DELIVERY,
                    LocalDateTime.now().plusDays(7)
            );
        }
        if (MOCK_COMPLETED_ORDER_ID.equals(orderId)) {
            return new OrderSnapshot(
                    MOCK_COMPLETED_ORDER_ID,
                    MOCK_CUSTOMER_ID,
                    MOCK_PROVIDER_ID,
                    COMPLETED,
                    LocalDateTime.now().minusDays(1)
            );
        }
        throw new BusinessException(ErrorCode.NOT_FOUND, "订单不存在");
    }

    @Override
    public String changeStatus(Long orderId, String targetStatus, Long operatorId, String remark) {
        if (!MOCK_DELIVERY_ORDER_ID.equals(orderId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "订单不存在");
        }
        if (!DELIVERED_PENDING_CONFIRM.equals(targetStatus)) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "目标状态不允许");
        }
        return DELIVERED_PENDING_CONFIRM;
    }
}
