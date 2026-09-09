package com.action.camera.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record NativeRefreshRequest(
        @NotBlank(message = "刷新凭据不能为空")
        @Size(max = 512, message = "刷新凭据格式不正确")
        String refreshToken
) {
}
