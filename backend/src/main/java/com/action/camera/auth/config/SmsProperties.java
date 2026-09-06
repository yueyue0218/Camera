package com.action.camera.auth.config;

import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

@Component
@Validated
@ConfigurationProperties(prefix = "camera.sms")
@Getter
@Setter
public class SmsProperties {

    private String provider = "";
    private String endpoint = "dysmsapi.aliyuncs.com";
    private String accessKeyId = "";
    private String accessKeySecret = "";
    private String signName = "";
    private String loginTemplateId = "";
    private String codePepper = "";
    private Duration codeTtl = Duration.ofMinutes(5);
    private Duration resendCooldown = Duration.ofSeconds(60);

    @Min(1)
    private int maxAttempts = 5;

    @Min(1)
    private long phoneHourlyLimit = 5;

    @Min(1)
    private long phoneDailyLimit = 20;

    @Min(1)
    private long ipHourlyLimit = 20;

    @Min(1)
    private long ipDailyLimit = 100;

    @Min(1)
    private long deviceHourlyLimit = 10;

    @Min(1)
    private long deviceDailyLimit = 50;
}
