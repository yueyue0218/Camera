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

    private String serviceType;

    private String displayName;

    private String bio;

    private String cityCode;

    private String cityArea;

    private BigDecimal priceMin;

    private BigDecimal priceMax;

    private Boolean acceptingOrders;

    private BigDecimal avgRating;

    private Integer completedOrders;

    private String auditStatus;

    private Integer age;

    private String equipment;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
