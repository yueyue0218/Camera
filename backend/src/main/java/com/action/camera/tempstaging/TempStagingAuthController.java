package com.action.camera.tempstaging;

import com.action.camera.auth.service.RefreshCookieService;
import com.action.camera.auth.service.SessionAuthenticationResult;
import com.action.camera.common.Result;
import com.action.camera.dto.LoginResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("temp-staging")
@RequestMapping("/auth/temp-staging")
public class TempStagingAuthController {

    private final TempStagingLoginService loginService;
    private final RefreshCookieService cookieService;

    public TempStagingAuthController(TempStagingLoginService loginService,
                                     RefreshCookieService cookieService) {
        this.loginService = loginService;
        this.cookieService = cookieService;
    }

    @PostMapping("/login")
    public Result<LoginResponse> login(@Valid @RequestBody TempStagingLoginRequest request,
                                       HttpServletRequest servletRequest,
                                       HttpServletResponse response) {
        SessionAuthenticationResult result = loginService.login(request, clientIp(servletRequest));
        response.addHeader(HttpHeaders.SET_COOKIE, cookieService.create(result.refreshToken(), result.refreshTtl()));
        return Result.success(result.response());
    }

    private String clientIp(HttpServletRequest request) {
        String remoteAddress = request.getRemoteAddr();
        String realIp = request.getHeader("X-Real-IP");
        if (isLoopback(remoteAddress)
                && realIp != null
                && realIp.matches("[0-9A-Fa-f:.]{2,45}")) {
            return realIp;
        }
        return remoteAddress == null || remoteAddress.isBlank() ? "unknown" : remoteAddress;
    }

    private boolean isLoopback(String address) {
        return "127.0.0.1".equals(address)
                || "0:0:0:0:0:0:0:1".equals(address)
                || "::1".equals(address);
    }
}
