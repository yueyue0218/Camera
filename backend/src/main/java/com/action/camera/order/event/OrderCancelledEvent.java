package com.action.camera.order.event;

import com.action.camera.order.entity.Order;

public record OrderCancelledEvent(Order order) {
}
