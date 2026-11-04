package com.action.camera.account.dto;

import jakarta.validation.constraints.Size;

public class AccountCancellationCreateRequest {

    @Size(max = 500, message = "注销原因不能超过500个字符")
    private String reason;

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
