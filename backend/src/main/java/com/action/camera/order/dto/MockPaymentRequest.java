package com.action.camera.order.dto;

import lombok.Data;

@Data
public class MockPaymentRequest {

    private String payMethod;
    private Long amountCent;
}
