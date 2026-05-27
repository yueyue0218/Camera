package com.action.camera.delivery.port;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class OrderSnapshot {

    private Long orderId;
    private Long customerId;
    private Long providerId;
    private String status;
    private LocalDateTime deliveryDeadline;
}
