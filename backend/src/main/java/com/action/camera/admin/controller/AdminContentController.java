package com.action.camera.admin.controller;

import com.action.camera.admin.dto.AdminHallItemResponse;
import com.action.camera.admin.dto.AdminHallItemType;
import com.action.camera.admin.dto.AdminModerationFilter;
import com.action.camera.admin.dto.AdminMomentResponse;
import com.action.camera.admin.dto.ModerationReasonRequest;
import com.action.camera.admin.service.AdminHallService;
import com.action.camera.admin.service.AdminMomentService;
import com.action.camera.admin.service.ContentModerationService;
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
@RequestMapping("/admin")
public class AdminContentController {

    private final AdminHallService adminHallService;
    private final AdminMomentService adminMomentService;
    private final ContentModerationService contentModerationService;

    public AdminContentController(AdminHallService adminHallService,
                                  AdminMomentService adminMomentService,
                                  ContentModerationService contentModerationService) {
        this.adminHallService = adminHallService;
        this.adminMomentService = adminMomentService;
        this.contentModerationService = contentModerationService;
    }

    @GetMapping("/hall-items")
    public Result<PageResult<AdminHallItemResponse>> listHallItems(
            @RequestParam(defaultValue = "ALL") String type,
            @RequestParam(defaultValue = "ALL") String status,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return Result.success(adminHallService.list(
                AdminHallItemType.parse(type),
                AdminModerationFilter.parse(status),
                keyword,
                page,
                size));
    }

    @PatchMapping("/hall-items/{type}/{id}/take-down")
    public Result<AdminHallItemResponse> takeDownHallItem(
            @PathVariable String type,
            @PathVariable Long id,
            @RequestBody(required = false) ModerationReasonRequest request) {
        return Result.success(contentModerationService.takeDownHallItem(
                AdminHallItemType.parse(type),
                id,
                request == null ? null : request.getReason()));
    }

    @PatchMapping("/hall-items/{type}/{id}/restore")
    public Result<AdminHallItemResponse> restoreHallItem(
            @PathVariable String type,
            @PathVariable Long id,
            @RequestBody(required = false) ModerationReasonRequest request) {
        return Result.success(contentModerationService.restoreHallItem(
                AdminHallItemType.parse(type),
                id,
                request == null ? null : request.getReason()));
    }

    @GetMapping("/moments")
    public Result<PageResult<AdminMomentResponse>> listMoments(
            @RequestParam(defaultValue = "ALL") String status,
            @RequestParam(required = false) Long authorId,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return Result.success(adminMomentService.list(
                AdminModerationFilter.parse(status), authorId, keyword, page, size));
    }

    @PatchMapping("/moments/{momentId}/take-down")
    public Result<AdminMomentResponse> takeDownMoment(
            @PathVariable Long momentId,
            @RequestBody(required = false) ModerationReasonRequest request) {
        return Result.success(contentModerationService.takeDownMoment(
                momentId, request == null ? null : request.getReason()));
    }

    @PatchMapping("/moments/{momentId}/restore")
    public Result<AdminMomentResponse> restoreMoment(
            @PathVariable Long momentId,
            @RequestBody(required = false) ModerationReasonRequest request) {
        return Result.success(contentModerationService.restoreMoment(
                momentId, request == null ? null : request.getReason()));
    }
}
