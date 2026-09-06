package com.action.camera.auth.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;

public class SmsSendFailedException extends BusinessException {

    public SmsSendFailedException() {
        super(ErrorCode.INTERNAL_ERROR, "短信暂时无法发送，请稍后重试");
    }
}
