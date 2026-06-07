package com.action.camera.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SendCodeRequest {

    @NotBlank(message = "邮箱不能为空")
    @Pattern(regexp = "^\\d{9}@smail\\.nju\\.edu\\.cn$", message = "请使用 9 位学号的南大邮箱")
    private String email;
}