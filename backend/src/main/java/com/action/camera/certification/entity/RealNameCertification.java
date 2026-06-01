package com.action.camera.certification.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@TableName("real_name_certifications")
public class RealNameCertification {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private String realName;

    /** 脱敏存储：前3位明文 + 中间若干 * + 后4位明文 */
    private String idCardNumber;

    private Long idCardFrontFileId;

    private Long idCardBackFileId;

    /** PENDING / APPROVED / REJECTED */
    private String status;

    private String rejectReason;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    private LocalDateTime reviewedAt;

    private Long reviewerAdminId;
}
