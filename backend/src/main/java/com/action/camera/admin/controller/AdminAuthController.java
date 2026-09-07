package com.action.camera.admin.controller;

import com.action.camera.application.UserService;
import com.action.camera.common.Result;
import com.action.camera.auth.service.RefreshCookieService;
import com.action.camera.auth.service.SessionAuthenticationResult;
import com.action.camera.dto.AdminLoginRequest;
import com.action.camera.dto.LoginResponse;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin")
public class AdminAuthController {

    private final UserService userService;
    private final RefreshCookieService cookieService;

    public AdminAuthController(UserService userService, RefreshCookieService cookieService) {
        this.userService = userService;
        this.cookieService = cookieService;
    }

    @PostMapping("/login")
    public Result<LoginResponse> login(@Valid @RequestBody AdminLoginRequest request,
                                       HttpServletRequest servletRequest,
                                       HttpServletResponse servletResponse) {
        SessionAuthenticationResult result = userService.adminLogin(
                request.getStudentNo(), request.getPassword(), "admin-web",
                servletRequest.getHeader("User-Agent"));
        servletResponse.addHeader(
                HttpHeaders.SET_COOKIE,
                cookieService.create(result.refreshToken(), result.refreshTtl()));
        return Result.success(result.response());
    }
}
