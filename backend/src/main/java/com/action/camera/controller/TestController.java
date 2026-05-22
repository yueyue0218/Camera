package com.action.camera.controller;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.JwtUtil;
import com.action.camera.common.Result;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.infrastructure.storage.FileStorage;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
public class TestController {

    private final JwtUtil jwtUtil;
    private final FileStorage fileStorage;

    public TestController(JwtUtil jwtUtil, FileStorage fileStorage) {
        this.jwtUtil = jwtUtil;
        this.fileStorage = fileStorage;
    }

    @GetMapping("/test/success")
    public Result<String> testSuccess() {
        return Result.success("骨架搭建成功！Camera 平台后端已就绪。");
    }

    @GetMapping("/test/error")
    public Result<?> testError() {
        throw new BusinessException(ErrorCode.UNAUTHORIZED);
    }

    @GetMapping("/test/token")
    public Result<String> testToken() {
        return Result.success(jwtUtil.generateToken(1L));
    }

    @GetMapping("/secure/me")
    public Result<Long> me() {
        return Result.success(UserContext.getUserId());
    }

    /** 测试文件上传，返回 fileKey */
    @PostMapping("/test/upload")
    public Result<String> testUpload(@RequestParam("file") MultipartFile file) {
        return Result.success(fileStorage.store(file));
    }
}