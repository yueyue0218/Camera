package com.action.camera.controller;

import com.action.camera.application.VerificationCodeService;
import com.action.camera.auth.dto.SendSmsCodeRequest;
import com.action.camera.auth.dto.VerifySmsCodeRequest;
import com.action.camera.auth.service.PhoneAuthenticationResult;
import com.action.camera.auth.service.PhoneAuthenticationService;
import com.action.camera.auth.service.PhoneSmsService;
import com.action.camera.common.Result;
import com.action.camera.dto.SendCodeRequest;
import com.action.camera.dto.LoginResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final VerificationCodeService codeService;
    private final PhoneSmsService phoneSmsService;
    private final PhoneAuthenticationService phoneAuthenticationService;

    public AuthController(VerificationCodeService codeService,
                          PhoneSmsService phoneSmsService,
                          PhoneAuthenticationService phoneAuthenticationService) {
        this.codeService = codeService;
        this.phoneSmsService = phoneSmsService;
        this.phoneAuthenticationService = phoneAuthenticationService;
    }

    @PostMapping("/send-code")
    public Result<Void> sendCode(@Valid @RequestBody SendCodeRequest req) {
        codeService.sendCode(req.getEmail());
        return Result.success(null);
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
        PhoneAuthenticationResult result = phoneAuthenticationService.verifyAndLogin(
                req.getPhone(), req.smsPurpose(), req.getCode(), req.getDeviceId(), req.getDeviceName());
        ResponseCookie refreshCookie = ResponseCookie.from(result.refreshCookieName(), result.refreshToken())
                .httpOnly(true)
                .secure(true)
                .sameSite("Lax")
                .path("/auth/refresh")
                .maxAge(result.refreshTtl())
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, refreshCookie.toString());
        return Result.success(result.response());
    }
}
