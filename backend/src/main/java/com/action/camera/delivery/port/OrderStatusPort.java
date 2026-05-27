package com.action.camera.delivery.port;

public interface OrderStatusPort {

    String changeStatus(Long orderId, String targetStatus, Long operatorId, String remark);
}
