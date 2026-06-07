package com.action.camera.auth.controller;

import com.action.camera.auth.dto.SessionLoginRequest;
import com.action.camera.auth.dto.SessionLoginResponse;
import com.action.camera.auth.dto.SessionUserDto;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.JwtUtil;
import com.action.camera.common.Result;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.security.UserRole;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SessionController {

    private static final Long DEMO_CUSTOMER_ID = 1001L;
    private static final Long DEMO_PROVIDER_ID = 2001L;

    private final JwtUtil jwtUtil;

    public SessionController(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @PostMapping("/sessions")
    public Result<SessionLoginResponse> login(@RequestBody SessionLoginRequest request) {
        validate(request);
        UserRole role = UserRole.parse(request.getRole(), UserRole.CUSTOMER);
        if (role == UserRole.ADMIN) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "演示端暂不支持管理员登录");
        }

        Long userId = role == UserRole.PROVIDER ? DEMO_PROVIDER_ID : DEMO_CUSTOMER_ID;
        String token = jwtUtil.generateToken(userId);
        SessionUserDto user = new SessionUserDto(userId, role.name(), request.getMobile().trim(), false);
        SessionLoginResponse response = new SessionLoginResponse(
                token,
                "refresh-" + role.name().toLowerCase() + "-" + userId,
                jwtUtil.getExpireSeconds(),
                user
        );
        return Result.success(response);
    }

    private void validate(SessionLoginRequest request) {
        if (request == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "请求体不能为空");
        }
        if (request.getLoginType() == null || !request.getLoginType().equalsIgnoreCase("MOBILE")) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "当前登录页仅支持手机号登录");
        }
        if (request.getMobile() == null || !request.getMobile().trim().matches("^1\\d{10}$")) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "手机号格式不正确");
        }
        if (request.getVerifyCode() == null || !request.getVerifyCode().trim().matches("^\\d{6}$")) {
            throw new BusinessException(ErrorCode.SMS_CODE_INVALID, "验证码必须是 6 位数字");
        }
        UserRole.parse(request.getRole(), UserRole.CUSTOMER);
    }
}
