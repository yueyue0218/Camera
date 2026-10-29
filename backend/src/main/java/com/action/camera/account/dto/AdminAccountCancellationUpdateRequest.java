package com.action.camera.account.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminAccountCancellationUpdateRequest(
        @NotBlank(message = "处理状态不能为空") String status,
        @NotBlank(message = "处理说明不能为空")
        @Size(max = 500, message = "处理说明不能超过500个字符") String resolutionNote) {
}
