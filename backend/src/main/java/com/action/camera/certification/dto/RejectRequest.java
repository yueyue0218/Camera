package com.action.camera.certification.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RejectRequest {

    @NotBlank(message = "拒绝原因不能为空")
    @Size(max = 500, message = "拒绝原因不超过 500 字")
    private String rejectReason;
}
