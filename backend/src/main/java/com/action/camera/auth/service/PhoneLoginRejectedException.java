package com.action.camera.auth.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;

public class PhoneLoginRejectedException extends BusinessException {

    public PhoneLoginRejectedException() {
        super(ErrorCode.VALIDATION_ERROR, "暂时无法登录");
    }
}
