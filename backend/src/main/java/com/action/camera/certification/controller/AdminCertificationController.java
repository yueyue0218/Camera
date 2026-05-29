package com.action.camera.certification.controller;

import com.action.camera.certification.dto.CertificationResponse;
import com.action.camera.certification.dto.RejectRequest;
import com.action.camera.certification.service.CertificationService;
import com.action.camera.common.Result;
import com.action.camera.common.UserContext;
import com.action.camera.common.page.PageResult;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/certifications")
public class AdminCertificationController {

    private final CertificationService certificationService;

    public AdminCertificationController(CertificationService certificationService) {
        this.certificationService = certificationService;
    }

    /**
     * GET /api/admin/certifications?status=PENDING&page=0&size=10
     * 分页查询认证列表，需 ADMIN 角色（Service 层校验）。
     */
    @GetMapping
    public Result<PageResult<CertificationResponse>> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Long adminId = UserContext.getUserId();
        return Result.success(certificationService.listByStatus(status, page, size));
    }

    /**
     * POST /api/admin/certifications/{id}/approve
     * 审核通过，需 ADMIN 角色（Service 层校验）。
     */
    @PostMapping("/{id}/approve")
    public Result<Void> approve(@PathVariable Long id) {
        Long adminId = UserContext.getUserId();
        certificationService.approve(adminId, id);
        return Result.success(null, "审核通过");
    }

    /**
     * POST /api/admin/certifications/{id}/reject
     * 审核拒绝，需 ADMIN 角色（Service 层校验）。
     */
    @PostMapping("/{id}/reject")
    public Result<Void> reject(@PathVariable Long id,
                               @Validated @RequestBody RejectRequest request) {
        Long adminId = UserContext.getUserId();
        certificationService.reject(adminId, id, request.getRejectReason());
        return Result.success(null, "已拒绝该申请");
    }
}
