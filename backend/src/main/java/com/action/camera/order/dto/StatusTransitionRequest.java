package com.action.camera.order.dto;

import com.action.camera.order.enums.OrderStatus;
import lombok.Data;

@Data
public class StatusTransitionRequest {

    private OrderStatus targetStatus;
    private String reason;
}
