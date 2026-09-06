package com.action.camera.auth.sms.aliyun;

public record AliyunSmsResult(
        String code,
        String requestId,
        String bizId
) {
}
