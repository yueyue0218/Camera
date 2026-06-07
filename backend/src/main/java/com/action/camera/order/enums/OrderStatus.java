package com.action.camera.order.enums;

/**
 * Order lifecycle status for appointment photography service orders.
 */
public enum OrderStatus {

    PENDING_PAYMENT("待支付"),
    PAID_PENDING_SHOOT("已支付，资金托管中，待拍摄"),
    SHOOTING("拍摄中"),
    PENDING_DELIVERY("拍摄已结束，等待服务方上传交付文件"),
    DELIVERED_PENDING_CONFIRM("交付文件已上传，等待需求方确认完成"),
    COMPLETED("已完成"),
    CANCELLED("已取消"),
    REFUNDED("已退款"),
    APPEALING("申诉/争议中"),
    REWORK_REQUIRED("需要重新交付");

    private final String description;

    OrderStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
