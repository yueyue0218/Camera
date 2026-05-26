package com.action.camera.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LoginRequest {

    @NotBlank(message = "学号不能为空")
    @Pattern(regexp = "^\\d{9}$", message = "学号为 9 位数字")
    private String studentNo;

    @NotBlank(message = "密码不能为空")
    @Size(min = 6, max = 32, message = "密码长度需在 6-32 位之间")
    private String password;
}