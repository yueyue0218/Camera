package com.action.camera.admin.controller;

import com.action.camera.admin.dto.AdminDashboardResponse;
import com.action.camera.admin.dto.CertificationReviewRequest;
import com.action.camera.admin.dto.CertificationReviewResponse;
import com.action.camera.admin.service.AdminCertificationService;
import com.action.camera.admin.service.AdminDashboardService;
import com.action.camera.common.Result;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class AdminController {

    private final AdminDashboardService dashboardService;
    private final AdminCertificationService certificationService;

    public AdminController(AdminDashboardService dashboardService,
                           AdminCertificationService certificationService) {
        this.dashboardService = dashboardService;
        this.certificationService = certificationService;
    }

    @GetMapping("/admin/dashboard")
    public Result<AdminDashboardResponse> dashboard() {
        return Result.success(dashboardService.getDashboard());
    }

    @GetMapping("/admin/certifications")
    public Result<List<CertificationReviewResponse>> listCertifications(@RequestParam(required = false) String type,
                                                                        @RequestParam(required = false) String status) {
        return Result.success(certificationService.list(type, status));
    }

    @PatchMapping("/admin/certifications/{type}/{certificationId}/review")
    public Result<CertificationReviewResponse> reviewCertification(@PathVariable String type,
                                                                   @PathVariable Long certificationId,
                                                                   @RequestBody CertificationReviewRequest request) {
        return Result.success(certificationService.review(type, certificationId, request));
    }
}
