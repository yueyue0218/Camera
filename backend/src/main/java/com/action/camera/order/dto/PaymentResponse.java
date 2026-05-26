package com.action.camera.order.dto;

import com.action.camera.order.entity.Order;
import com.action.camera.order.entity.PaymentRecord;
import com.action.camera.order.enums.EscrowStatus;
import com.action.camera.order.enums.OrderStatus;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class PaymentResponse {

    private Long paymentId;
    private String paymentNo;
    private Long orderId;
    private OrderStatus orderStatus;
    private EscrowStatus escrowStatus;
    private Long amountCent;
    private String payMethod;
    private LocalDateTime paidAt;

    public static PaymentResponse from(PaymentRecord paymentRecord, Order order) {
        return new PaymentResponse(
                paymentRecord.getId(),
                paymentRecord.getPaymentNo(),
                order.getId(),
                order.getStatus(),
                order.getEscrowStatus(),
                paymentRecord.getAmountCent(),
                paymentRecord.getPayMethod(),
                paymentRecord.getPaidAt()
        );
    }
}
