package com.action.camera.common;

import lombok.Data;

/**
 * 统一响应包装。所有接口都用这个格式返回。
 * 对应 P3 API 规范里的 {code, message, data}。
 */
@Data
public class Result<T> {

    private Integer code;
    private String message;
    private T data;

    private Result(Integer code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
    }

    /** 成功，带数据 */
    public static <T> Result<T> success(T data) {
        return new Result<>(200, "success", data);
    }

    /** 成功，不带数据 */
    public static <T> Result<T> success() {
        return new Result<>(200, "success", null);
    }

    /** 成功，自定义提示文案 */
    public static <T> Result<T> success(T data, String message) {
        return new Result<>(200, message, data);
    }

    /** 失败，用错误码枚举 */
    public static <T> Result<T> error(ErrorCode errorCode) {
        return new Result<>(errorCode.getCode(), errorCode.getMessage(), null);
    }

    /** 失败，自定义错误码和消息 */
    public static <T> Result<T> error(Integer code, String message) {
        return new Result<>(code, message, null);
    }
}