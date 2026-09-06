package com.action.camera.auth.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;

public class SmsCodeInvalidException extends BusinessException {

    public SmsCodeInvalidException() {
        super(ErrorCode.SMS_CODE_INVALID, "验证码无效或已过期");
    }
}
