package com.action.camera.auth.dto;

import com.action.camera.auth.domain.SmsPurpose;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SendSmsCodeRequest {

    @NotBlank(message = "手机号不能为空")
    @Size(max = 32, message = "手机号格式不正确")
    private String phone;

    @NotBlank(message = "验证码用途不能为空")
    @Pattern(regexp = "LOGIN", message = "当前只支持 LOGIN")
    private String purpose;

    @NotBlank(message = "设备标识不能为空")
    @Size(max = 128, message = "设备标识过长")
    private String deviceId;

    public SmsPurpose smsPurpose() {
        return SmsPurpose.valueOf(purpose);
    }
}
