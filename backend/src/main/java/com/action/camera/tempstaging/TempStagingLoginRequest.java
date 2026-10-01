package com.action.camera.tempstaging;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record TempStagingLoginRequest(
        @NotNull Long userId,
        @NotBlank @Size(max = 128) String password,
        @NotBlank @Size(max = 128) String deviceId,
        @Size(max = 128) String deviceName
) {
}
