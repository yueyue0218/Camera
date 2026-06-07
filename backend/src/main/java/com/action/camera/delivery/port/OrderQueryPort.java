package com.action.camera.delivery.port;

public interface OrderQueryPort {

    OrderSnapshot getOrderSnapshot(Long orderId);
}
