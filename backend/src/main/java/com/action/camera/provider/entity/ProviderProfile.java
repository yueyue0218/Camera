package com.action.camera.provider.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@TableName("provider_profiles")
public class ProviderProfile {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    /** 认证通过时间 */
    private LocalDateTime certifiedAt;

    /** 个人简介，待摄影师自行补充 */
    private String bio;

    /** 风格标签，逗号分隔，待摄影师自行补充 */
    private String styleTags;

    /** 所在城市，待摄影师自行补充 */
    private String cityCode;

    /** 每小时收费（元），待摄影师自行补充 */
    private BigDecimal pricePerHour;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
