package com.action.camera.provider.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class ProviderProfileUpdateDTO {

    @Size(max = 64, message = "显示名称不能超过 64 字")
    private String displayName;

    @Size(max = 500, message = "简介不能超过 500 字")
    private String bio;

    @Size(max = 32, message = "城市代码不能超过 32 字")
    private String cityCode;

    @Size(max = 64, message = "区域不能超过 64 字")
    private String cityArea;

    @DecimalMin(value = "0", message = "最低价格不能为负数")
    private BigDecimal priceMin;

    @DecimalMin(value = "0", message = "最高价格不能为负数")
    private BigDecimal priceMax;

    private Boolean acceptingOrders;

    @Min(value = 18, message = "年龄不能小于 18")
    @Max(value = 100, message = "年龄不能超过 100")
    private Integer age;

    @Size(max = 500, message = "设备描述不能超过 500 字")
    private String equipment;

    private List<Long> styleTagIds;
}
