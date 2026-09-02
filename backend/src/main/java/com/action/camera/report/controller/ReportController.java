package com.action.camera.report.controller;

import com.action.camera.common.Result;
import com.action.camera.report.dto.ReportCreateRequest;
import com.action.camera.report.dto.ReportResponse;
import com.action.camera.report.service.ReportService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class ReportController {
    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @PostMapping("/reports")
    public Result<ReportResponse> create(@RequestBody ReportCreateRequest request) {
        return Result.success(reportService.create(request));
    }

    @GetMapping("/reports/my")
    public Result<List<ReportResponse>> listMine() {
        return Result.success(reportService.listMine());
    }
}
