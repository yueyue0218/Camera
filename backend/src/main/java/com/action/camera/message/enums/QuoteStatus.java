package com.action.camera.message.enums;

/**
 * Status of a formal quote sent in a conversation.
 */
public enum QuoteStatus {

    PENDING_CONFIRM("待需求方确认"),
    CONFIRMED("已确认，并已生成订单"),
    REJECTED("已拒绝"),
    CANCELLED("服务方撤回"),
    EXPIRED("已过期");

    private final String description;

    QuoteStatus(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
