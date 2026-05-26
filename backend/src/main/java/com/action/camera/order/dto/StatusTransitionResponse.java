package com.action.camera.order.dto;

import com.action.camera.order.entity.OrderStatusLog;
import com.action.camera.order.enums.OrderStatus;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class StatusTransitionResponse {

    private Long orderId;
    private OrderStatus fromStatus;
    private OrderStatus toStatus;
    private Long operatorId;
    private String operatorRole;
    private String reason;
    private LocalDateTime createdAt;

    public static StatusTransitionResponse from(OrderStatusLog log) {
        return new StatusTransitionResponse(
                log.getOrderId(),
                log.getFromStatus(),
                log.getToStatus(),
                log.getOperatorId(),
                log.getOperatorRole(),
                log.getReason(),
                log.getCreatedAt()
        );
    }
}
