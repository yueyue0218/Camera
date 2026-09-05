package com.action.camera.admin.controller;

import com.action.camera.admin.dto.AdminUserDetailResponse;
import com.action.camera.admin.dto.AdminUserListItemResponse;
import com.action.camera.admin.dto.AdminUserStatusRequest;
import com.action.camera.admin.service.AdminUserService;
import com.action.camera.common.Result;
import com.action.camera.common.page.PageResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/users")
public class AdminUserController {

    private final AdminUserService adminUserService;

    public AdminUserController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
    }

    @GetMapping
    public Result<PageResult<AdminUserListItemResponse>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return Result.success(adminUserService.list(keyword, role, status, page, size));
    }

    @GetMapping("/{userId}")
    public Result<AdminUserDetailResponse> detail(@PathVariable Long userId) {
        return Result.success(adminUserService.detail(userId));
    }

    @PatchMapping("/{userId}/status")
    public Result<AdminUserDetailResponse> changeStatus(
            @PathVariable Long userId,
            @RequestBody(required = false) AdminUserStatusRequest request) {
        return Result.success(adminUserService.changeStatus(
                userId,
                request == null ? null : request.status(),
                request == null ? null : request.reason()));
    }
}
