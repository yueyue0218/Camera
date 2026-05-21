package com.action.camera.common;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 全局错误码。来自 P3 API 规范文档第 1.4 节。
 * 后续各模块的错误码都加在这里。
 */
@Getter
@AllArgsConstructor
public enum ErrorCode {

    // --- 成功 ---
    OK(200, "success"),

    // --- 400 参数错误 ---
    VALIDATION_ERROR(40001, "参数格式错误"),
    SMS_CODE_INVALID(40002, "短信验证码错误或已过期"),
    IDEMPOTENCY_KEY_REQUIRED(40003, "缺少幂等键"),

    // --- 401 认证 ---
    UNAUTHORIZED(40101, "未登录或 token 失效"),
    CALLBACK_SIGNATURE_INVALID(40102, "回调签名校验失败"),

    // --- 403 权限 ---
    FORBIDDEN(40301, "无权限执行该操作"),

    // --- 404 ---
    NOT_FOUND(40401, "资源不存在"),

    // --- 409 状态冲突 ---
    STATUS_CONFLICT(40901, "当前状态不允许该操作"),
    DUPLICATE_OPERATION(40902, "重复操作"),

    // --- 500 系统 ---
    INTERNAL_ERROR(50001, "系统内部错误");

    private final Integer code;
    private final String message;
}