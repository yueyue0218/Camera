package com.action.camera.controller;

import com.action.camera.auth.dto.SessionResponse;
import com.action.camera.auth.dto.SendSmsCodeRequest;
import com.action.camera.auth.dto.VerifySmsCodeRequest;
import com.action.camera.auth.service.AuthSessionService;
import com.action.camera.auth.service.PhoneAuthenticationService;
import com.action.camera.auth.service.PhoneSmsService;
import com.action.camera.auth.service.RefreshCookieService;
import com.action.camera.auth.service.SessionAuthenticationResult;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.Result;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.dto.LoginResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final PhoneSmsService phoneSmsService;
    private final PhoneAuthenticationService phoneAuthenticationService;
    private final AuthSessionService sessionService;
    private final RefreshCookieService cookieService;

    public AuthController(PhoneSmsService phoneSmsService,
                          PhoneAuthenticationService phoneAuthenticationService,
                          AuthSessionService sessionService,
                          RefreshCookieService cookieService) {
        this.phoneSmsService = phoneSmsService;
        this.phoneAuthenticationService = phoneAuthenticationService;
        this.sessionService = sessionService;
        this.cookieService = cookieService;
    }

    @PostMapping("/send-code")
    public Result<Void> deprecatedEmailSend() {
        throw legacyAuthDisabled();
    }

    @PostMapping("/sms/send")
    public Result<Void> sendSmsCode(@Valid @RequestBody SendSmsCodeRequest req,
                                    HttpServletRequest request) {
        phoneSmsService.sendCode(req.getPhone(), req.smsPurpose(), request.getRemoteAddr(), req.getDeviceId());
        return Result.success(null);
    }

    @PostMapping("/sms/verify")
    public Result<LoginResponse> verifySmsCode(@Valid @RequestBody VerifySmsCodeRequest req,
                                               HttpServletResponse response) {
        SessionAuthenticationResult result = phoneAuthenticationService.verifyAndLogin(
                req.getPhone(), req.smsPurpose(), req.getCode(), req.getDeviceId(), req.getDeviceName());
        response.addHeader(HttpHeaders.SET_COOKIE, cookieService.create(result.refreshToken(), result.refreshTtl()));
        return Result.success(result.response());
    }

    @PostMapping("/refresh")
    public Result<LoginResponse> refresh(HttpServletRequest request, HttpServletResponse response) {
        String refreshToken = cookieService.read(request)
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
        SessionAuthenticationResult result = sessionService.refresh(refreshToken);
        response.addHeader(HttpHeaders.SET_COOKIE, cookieService.create(result.refreshToken(), result.refreshTtl()));
        return Result.success(result.response());
    }

    @PostMapping("/logout")
    public Result<Void> logout(HttpServletResponse response) {
        sessionService.logout(UserContext.getUserId(), UserContext.getSessionId());
        response.addHeader(HttpHeaders.SET_COOKIE, cookieService.clear());
        return Result.success(null);
    }

    @GetMapping("/session")
    public Result<SessionResponse> session() {
        return Result.success(sessionService.current(UserContext.getUserId(), UserContext.getSessionId()));
    }

    private BusinessException legacyAuthDisabled() {
        return new BusinessException(ErrorCode.STATUS_CONFLICT, "该登录方式已停用，请使用手机号验证码登录");
    }
}
