package com.action.camera.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RegisterRequest {

    @NotBlank(message = "邮箱不能为空")
    @Pattern(regexp = "^\\d{9}@smail\\.nju\\.edu\\.cn$", message = "请使用 9 位学号的南大邮箱")
    private String email;

    @NotBlank(message = "验证码不能为空")
    @Size(min = 6, max = 6, message = "验证码为 6 位数字")
    private String code;

    @NotBlank(message = "密码不能为空")
    @Size(min = 6, max = 32, message = "密码长度需在 6-32 位之间")
    private String password;

    @NotBlank(message = "昵称不能为空")
    @Size(max = 64, message = "昵称不能超过 64 字")
    private String nickname;

    @NotBlank(message = "请选择身份")
    @Pattern(regexp = "^(CUSTOMER|PROVIDER)$", message = "身份只能为 CUSTOMER 或 PROVIDER")
    private String role;
}
