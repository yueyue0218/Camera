package com.action.camera.controller;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.Result;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.image.UnsupportedImageFileException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes = FileController.class)
public class FileEndpointExceptionHandler {

    @ExceptionHandler(FileBinaryException.class)
    public ResponseEntity<Result<?>> handleFileBinary(FileBinaryException error) {
        return response(error.getStatus(), error.getErrorCode(), error.getMessage());
    }

    @ExceptionHandler(UnsupportedImageFileException.class)
    public ResponseEntity<Result<?>> handleUnsupportedImage(UnsupportedImageFileException error) {
        return response(
                HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                error.getErrorCode(),
                error.getMessage());
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<Result<?>> handleBusinessException(BusinessException error) {
        return response(
                statusFor(error.getErrorCode()),
                error.getErrorCode(),
                error.getMessage());
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Result<?>> handleInvalidPathParameter(
            MethodArgumentTypeMismatchException error) {
        return response(
                HttpStatus.BAD_REQUEST,
                ErrorCode.VALIDATION_ERROR,
                "非法文件参数");
    }

    private ResponseEntity<Result<?>> response(
            HttpStatus status, ErrorCode errorCode, String message) {
        return ResponseEntity.status(status)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Result.error(errorCode.getCode(), message));
    }

    private HttpStatus statusFor(ErrorCode errorCode) {
        return switch (errorCode) {
            case VALIDATION_ERROR -> HttpStatus.BAD_REQUEST;
            case UNAUTHORIZED -> HttpStatus.UNAUTHORIZED;
            case FORBIDDEN -> HttpStatus.FORBIDDEN;
            case NOT_FOUND -> HttpStatus.NOT_FOUND;
            case INTERNAL_ERROR -> HttpStatus.INTERNAL_SERVER_ERROR;
            default -> HttpStatus.INTERNAL_SERVER_ERROR;
        };
    }
}
