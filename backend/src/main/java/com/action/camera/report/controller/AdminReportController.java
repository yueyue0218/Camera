package com.action.camera.report.controller;

import com.action.camera.common.Result;
import com.action.camera.common.page.PageResult;
import com.action.camera.report.dto.ReportResolveRequest;
import com.action.camera.report.dto.ReportResponse;
import com.action.camera.report.service.ReportService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AdminReportController {
    private final ReportService reportService;

    public AdminReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/admin/reports")
    public Result<PageResult<ReportResponse>> list(
            @RequestParam(required = false) String targetType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return Result.success(reportService.listForAdmin(targetType, status, keyword, page, size));
    }

    @GetMapping("/admin/reports/{reportId}")
    public Result<ReportResponse> detail(@PathVariable Long reportId) {
        return Result.success(reportService.adminDetail(reportId));
    }

    @PatchMapping("/admin/reports/{reportId}/resolve")
    public Result<ReportResponse> resolve(@PathVariable Long reportId,
                                          @RequestBody ReportResolveRequest request) {
        return Result.success(reportService.resolve(reportId, request));
    }
}
