package com.action.camera.controller;

import com.action.camera.application.UserService;
import com.action.camera.common.Result;
import com.action.camera.common.UserContext;
import com.action.camera.dto.LoginRequest;
import com.action.camera.dto.LoginResponse;
import com.action.camera.dto.RegisterRequest;
import com.action.camera.dto.SwitchRoleRequest;
import com.action.camera.dto.SwitchRoleResponse;
import com.action.camera.dto.UserBriefResponse;
import com.action.camera.dto.UserProfileResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/register")
    public Result<Void> register(@Valid @RequestBody RegisterRequest req) {
        userService.register(req.getEmail(), req.getCode(), req.getPassword(), req.getNickname(), req.getRole());
        return Result.success(null, "注册成功");
    }

    @PostMapping("/login")
    public Result<LoginResponse> login(@Valid @RequestBody LoginRequest req) {
        LoginResponse response = userService.login(req.getStudentNo(), req.getPassword(), req.getRole());
        return Result.success(response);
    }

    @GetMapping("/me")
    public Result<UserProfileResponse> getMyProfile() {
        Long userId = UserContext.getUserId();
        return Result.success(userService.getMyProfile(userId));
    }

    @GetMapping("/{id}/brief")
    public Result<UserBriefResponse> getUserBrief(@PathVariable Long id) {
        return Result.success(userService.getUserBrief(id));
    }

    @PostMapping("/me/role")
    public Result<SwitchRoleResponse> switchRole(@RequestBody SwitchRoleRequest req) {
        Long userId = UserContext.getUserId();
        return Result.success(userService.switchRole(userId, req.getRole()));
    }
}
