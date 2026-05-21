package com.action.camera.common.exception;

import com.action.camera.common.ErrorCode;
import lombok.Getter;

/**
 * 业务异常。在代码任何地方 throw new BusinessException(ErrorCode.XXX) 即可，
 * 全局异常处理器会自动捕获并返回统一格式。
 */
@Getter
public class BusinessException extends RuntimeException {

    private final ErrorCode errorCode;

    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    /** 可以附加更详细的说明 */
    public BusinessException(ErrorCode errorCode, String detail) {
        super(detail);
        this.errorCode = errorCode;
    }
}