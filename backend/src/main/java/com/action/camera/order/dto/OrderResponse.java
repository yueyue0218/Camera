package com.action.camera.order.dto;

import com.action.camera.order.entity.Order;
import com.action.camera.order.enums.EscrowStatus;
import com.action.camera.order.enums.OrderStatus;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class OrderResponse {

    private Long orderId;
    private String orderNo;
    private Long quoteId;
    private Long conversationId;
    private Long customerId;
    private Long providerUserId;
    private Long demandId;
    private OrderStatus status;
    private EscrowStatus escrowStatus;
    private String settlementStatus;
    private String refundStatus;
    private Long amountCent;
    private LocalDateTime shootStartTime;
    private LocalDateTime shootEndTime;
    private LocalDateTime deliveryDeadline;
    private String quoteSnapshotJson;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static OrderResponse from(Order order) {
        return new OrderResponse(
                order.getId(),
                order.getOrderNo(),
                order.getQuoteId(),
                order.getConversationId(),
                order.getCustomerId(),
                order.getProviderUserId(),
                order.getDemandId(),
                order.getStatus(),
                order.getEscrowStatus(),
                order.getSettlementStatus(),
                order.getRefundStatus(),
                order.getTotalAmountCent(),
                order.getShootStartTime(),
                order.getShootEndTime(),
                order.getDeliveryDeadline(),
                order.getQuoteSnapshotJson(),
                order.getCreatedAt(),
                order.getUpdatedAt()
        );
    }
}
