package com.action.camera.certification.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CertificationRequest {

    @NotBlank(message = "真实姓名不能为空")
    @Size(min = 2, max = 50, message = "姓名长度需在 2-50 位之间")
    private String realName;

    @NotBlank(message = "身份证号不能为空")
    @Pattern(regexp = "^\\d{17}[\\dXx]$", message = "身份证号格式不正确（18位，末位可为X）")
    private String idCardNumber;

    @NotNull(message = "身份证正面照片不能为空")
    private Long idCardFrontFileId;

    @NotNull(message = "身份证背面照片不能为空")
    private Long idCardBackFileId;
}
