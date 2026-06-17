package com.action.camera.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminLoginRequest {

    @NotBlank(message = "studentNo is required")
    @Pattern(regexp = "^\\d{9}$", message = "studentNo must be 9 digits")
    private String studentNo;

    @NotBlank(message = "password is required")
    @Size(min = 6, max = 32, message = "password must be between 6 and 32 characters")
    private String password;
}
