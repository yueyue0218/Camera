package com.action.camera.certification.controller;

import com.action.camera.certification.dto.CertificationRequest;
import com.action.camera.certification.dto.CertificationResponse;
import com.action.camera.certification.service.CertificationService;
import com.action.camera.common.Result;
import com.action.camera.common.UserContext;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/certifications")
public class CertificationController {

    private final CertificationService certificationService;

    public CertificationController(CertificationService certificationService) {
        this.certificationService = certificationService;
    }

    /**
     * POST /api/certifications
     * 提交实名认证申请，CUSTOMER 和 PROVIDER 均可。
     */
    @PostMapping
    public Result<CertificationResponse> submit(@Validated @RequestBody CertificationRequest request) {
        Long userId = UserContext.getUserId();
        CertificationResponse response = certificationService.submit(userId, request);
        return Result.success(response, "认证申请提交成功，请等待审核");
    }

    /**
     * GET /api/certifications/me
     * 查询当前用户最新认证状态。
     */
    @GetMapping("/me")
    public Result<CertificationResponse> getMyLatest() {
        Long userId = UserContext.getUserId();
        return Result.success(certificationService.getMyLatest(userId));
    }
}
