package com.action.camera.controller;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.Result;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.infrastructure.storage.FileStorage;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
public class TestController {

    private final FileStorage fileStorage;

    public TestController(FileStorage fileStorage) {
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

    /** 需携带 Bearer token；由拦截器解析后从 UserContext 取当前用户 id */
    @GetMapping("/test/token")
    public Result<String> testToken() {
        return Result.success("Current user ID: " + UserContext.getUserId());
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