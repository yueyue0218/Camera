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
@TableName("audit_records")
public class AuditRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 审核目标类型，如 "REAL_NAME_CERT" */
    private String targetType;

    private Long targetId;

    private Long adminId;

    /** APPROVE / REJECT */
    private String action;

    private String reason;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
