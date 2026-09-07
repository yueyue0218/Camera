package com.action.camera.auth.config;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.validator.constraints.time.DurationMin;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

@Component
@Validated
@ConfigurationProperties(prefix = "jwt")
@Getter
@Setter
public class JwtProperties {

    @NotBlank
    private String secret;

    @DurationMin(seconds = 60)
    private Duration accessTtl = Duration.ofMinutes(15);
}
