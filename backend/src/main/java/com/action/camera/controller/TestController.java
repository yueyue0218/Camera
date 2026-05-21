package com.action.camera.controller;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.Result;
import com.action.camera.common.exception.BusinessException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 测试接口。验证统一响应、错误码、全局异常处理都正常工作。
 * 上线前可以删掉。
 */
@RestController
public class TestController {

    /** 测试成功返回 */
    @GetMapping("/test/success")
    public Result<String> testSuccess() {
        return Result.success("骨架搭建成功！Camera 平台后端已就绪。");
    }

    /** 测试业务异常返回 */
    @GetMapping("/test/error")
    public Result<?> testError() {
        throw new BusinessException(ErrorCode.UNAUTHORIZED);
    }
}