package com.action.camera.provider.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class ProviderProfilePublicVO {

    private Long providerId;
    private String nickname;
    private String gender;
    private String avatarUrl;
    private String cityCode;
    private String cityArea;
    private BigDecimal creditScore;
    private BigDecimal avgRating;
    private Integer completedOrders;
    private List<String> styleTags;
    private String equipment;
    private Integer age;
    private BigDecimal priceMin;
    private BigDecimal priceMax;
    private Boolean acceptingOrders;
    private String serviceType;
}
