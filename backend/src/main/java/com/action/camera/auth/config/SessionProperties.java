package com.action.camera.auth.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.validator.constraints.time.DurationMin;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

@Component
@Validated
@ConfigurationProperties(prefix = "camera.session")
@Getter
@Setter
public class SessionProperties {

    @NotBlank
    @Pattern(regexp = "[A-Za-z0-9_-]{1,64}")
    private String refreshCookieName = "camera_refresh";

    @DurationMin(seconds = 60)
    private Duration refreshTtl = Duration.ofDays(30);
}
