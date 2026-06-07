package com.action.camera.common.exception;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.Result;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

/**
 * 全局异常处理器。不管哪个 Controller 抛异常，都会被这里兜住，
 * 自动转成统一的 {code, message, data} 格式返回给前端。
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    /** 业务异常 → 返回对应错误码 */
    @ExceptionHandler(BusinessException.class)
    public Result<?> handleBusinessException(BusinessException e) {
        return Result.error(e.getErrorCode().getCode(), e.getMessage());
    }

    /** 参数校验异常（@Valid 触发）→ 返回 40001 */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Result<?> handleValidationException(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .findFirst()
                .orElse("参数校验失败");
        return Result.error(ErrorCode.VALIDATION_ERROR.getCode(), msg);
    }

    /** 兜底：未预料的异常 → 返回 50001 */
    @ExceptionHandler({
            MissingServletRequestPartException.class,
            MissingServletRequestParameterException.class
    })
    public Result<?> handleMissingRequestPart(Exception e) {
        return Result.error(ErrorCode.VALIDATION_ERROR.getCode(), e.getMessage());
    }

    @ExceptionHandler(Exception.class)
    public Result<?> handleException(Exception e) {
        return Result.error(ErrorCode.INTERNAL_ERROR.getCode(),
                "系统内部错误: " + e.getMessage());
    }
}
