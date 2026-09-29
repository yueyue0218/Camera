package com.action.camera.controller;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import org.springframework.http.HttpStatus;

public final class FileBinaryException extends BusinessException {

    private final HttpStatus status;

    public FileBinaryException(HttpStatus status, ErrorCode errorCode, String message) {
        super(errorCode, message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
