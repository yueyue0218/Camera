package com.action.camera.controller;

import com.action.camera.application.VerificationCodeService;
import com.action.camera.common.Result;
import com.action.camera.dto.SendCodeRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final VerificationCodeService codeService;

    public AuthController(VerificationCodeService codeService) {
        this.codeService = codeService;
    }

    @PostMapping("/send-code")
    public Result<Void> sendCode(@Valid @RequestBody SendCodeRequest req) {
        codeService.sendCode(req.getEmail());
        return Result.success(null);
    }
}