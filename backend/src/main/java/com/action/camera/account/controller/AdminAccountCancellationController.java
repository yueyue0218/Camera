package com.action.camera.account.controller;

import com.action.camera.account.dto.AdminAccountCancellationResponse;
import com.action.camera.account.dto.AdminAccountCancellationUpdateRequest;
import com.action.camera.account.service.AdminAccountCancellationService;
import com.action.camera.common.Result;
import com.action.camera.common.page.PageResult;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/account-cancellations")
public class AdminAccountCancellationController {

    private final AdminAccountCancellationService service;

    public AdminAccountCancellationController(AdminAccountCancellationService service) {
        this.service = service;
    }

    @GetMapping
    public Result<PageResult<AdminAccountCancellationResponse>> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return Result.success(service.list(status, page, size));
    }

    @PatchMapping("/{requestId}")
    public Result<AdminAccountCancellationResponse> update(
            @PathVariable Long requestId,
            @Valid @RequestBody AdminAccountCancellationUpdateRequest request) {
        return Result.success(service.update(requestId, request));
    }
}
