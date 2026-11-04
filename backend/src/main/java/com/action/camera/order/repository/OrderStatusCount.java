package com.action.camera.order.repository;

import com.action.camera.order.enums.OrderStatus;

public interface OrderStatusCount {
    OrderStatus getStatus();
    long getTotal();
}
