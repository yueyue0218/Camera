package com.action.camera.admin.controller;

import com.action.camera.application.UserService;
import com.action.camera.common.Result;
import com.action.camera.dto.AdminLoginRequest;
import com.action.camera.dto.LoginResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin")
public class AdminAuthController {

    private final UserService userService;

    public AdminAuthController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/login")
    public Result<LoginResponse> login(@Valid @RequestBody AdminLoginRequest request) {
        return Result.success(userService.adminLogin(request.getStudentNo(), request.getPassword()));
    }
}
