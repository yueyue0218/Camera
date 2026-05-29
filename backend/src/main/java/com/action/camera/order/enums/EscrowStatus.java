package com.action.camera.order.enums;

/**
 * Fund escrow status for simulated platform-held payments.
 */
public enum EscrowStatus {

    NOT_PAID("未支付 / 未托管"),
    HELD("已支付，资金平台托管中"),
    RELEASED("已结算给服务方"),
    REFUNDED("已退款");

    private final String description;

    EscrowStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
