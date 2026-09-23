package com.action.camera.image;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;

public class UnsupportedImageFileException extends BusinessException {

    public UnsupportedImageFileException(String message) {
        super(ErrorCode.VALIDATION_ERROR, message);
    }
}
