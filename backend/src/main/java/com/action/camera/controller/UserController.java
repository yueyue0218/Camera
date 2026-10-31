package com.action.camera.controller;

import com.action.camera.account.dto.AccountCancellationCreateRequest;
import com.action.camera.account.dto.AccountCancellationResponse;
import com.action.camera.account.service.AccountCancellationService;
import com.action.camera.application.UserService;
import com.action.camera.common.Result;
import com.action.camera.common.UserContext;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.dto.SwitchRoleRequest;
import com.action.camera.dto.SwitchRoleResponse;
import com.action.camera.dto.UpdateProfileRequest;
import com.action.camera.dto.UserBriefResponse;
import com.action.camera.dto.UserProfileResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/users")
public class UserController {

    private final UserService userService;
    private final AccountCancellationService accountCancellationService;

    public UserController(UserService userService,
                          AccountCancellationService accountCancellationService) {
        this.userService = userService;
        this.accountCancellationService = accountCancellationService;
    }

    @PostMapping("/register")
    public Result<Void> deprecatedRegister() {
        throw legacyAuthDisabled();
    }

    @PostMapping("/login")
    public Result<Void> deprecatedLogin() {
        throw legacyAuthDisabled();
    }

    @GetMapping("/me")
    public Result<UserProfileResponse> getMyProfile() {
        Long userId = UserContext.getUserId();
        return Result.success(userService.getMyProfile(userId));
    }

    @GetMapping("/{id}/brief")
    public Result<UserBriefResponse> getUserBrief(@PathVariable Long id,
                                                  @RequestParam(required = false) String role) {
        return Result.success(userService.getUserBrief(id, role));
    }

    @PatchMapping("/me")
    public Result<Void> updateMyProfile(@RequestBody UpdateProfileRequest req) {
        Long userId = UserContext.getUserId();
        userService.updateMyProfile(userId, req);
        return Result.success(null);
    }

    @PostMapping("/me/role")
    public Result<SwitchRoleResponse> switchRole(@RequestBody SwitchRoleRequest req) {
        Long userId = UserContext.getUserId();
        return Result.success(userService.switchRole(userId, req.getRole()));
    }

    @GetMapping("/me/cancellation-request")
    public Result<AccountCancellationResponse> getCancellationRequest() {
        return Result.success(accountCancellationService.getStatus(UserContext.getUserId()));
    }

    @PostMapping("/me/cancellation-request")
    public Result<AccountCancellationResponse> requestCancellation(
            @Valid @RequestBody AccountCancellationCreateRequest request) {
        return Result.success(accountCancellationService.request(
                UserContext.getUserId(), request.getReason()));
    }

    private BusinessException legacyAuthDisabled() {
        return new BusinessException(ErrorCode.STATUS_CONFLICT, "该登录方式已停用，请使用手机号验证码登录");
    }
}
