package com.action.camera.auth.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;

public class RefreshTokenReplayException extends BusinessException {

    public RefreshTokenReplayException() {
        super(ErrorCode.UNAUTHORIZED, "会话已失效，请重新登录");
    }
}
