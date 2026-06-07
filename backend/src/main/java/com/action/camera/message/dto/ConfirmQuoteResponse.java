package com.action.camera.message.dto;

import com.action.camera.message.enums.QuoteStatus;
import com.action.camera.order.entity.Order;
import com.action.camera.order.enums.OrderStatus;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ConfirmQuoteResponse {

    private Long quotationId;
    private QuoteStatus quotationStatus;
    private Long orderId;
    private String orderNo;
    private OrderStatus orderStatus;

    public static ConfirmQuoteResponse from(Long quotationId, Order order) {
        return new ConfirmQuoteResponse(
                quotationId,
                QuoteStatus.CONFIRMED,
                order.getId(),
                order.getOrderNo(),
                order.getStatus()
        );
    }
}
