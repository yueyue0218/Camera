package com.action.camera.common.config;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Fails closed when production starts without externally supplied credentials.
 */
@Configuration(proxyBeanMethods = false)
@Profile("prod")
public class ProductionSecretsValidator implements InitializingBean {

    private static final int MINIMUM_JWT_SECRET_LENGTH = 32;

    private final Environment environment;

    public ProductionSecretsValidator(Environment environment) {
        this.environment = environment;
    }

    @Override
    public void afterPropertiesSet() {
        List<String> activeProfiles = Arrays.asList(environment.getActiveProfiles());
        if (activeProfiles.contains("dev") || activeProfiles.contains("smoke")) {
            throw new IllegalStateException("Production must not run with dev or smoke profiles");
        }

        List<String> missing = new ArrayList<>();
        requireText("spring.datasource.password", "SPRING_DATASOURCE_PASSWORD/DB_PASSWORD", missing);
        requireText("spring.mail.username", "SPRING_MAIL_USERNAME", missing);
        requireText("spring.mail.password", "SPRING_MAIL_PASSWORD", missing);
        requireText("jwt.secret", "JWT_SECRET", missing);

        if (!missing.isEmpty()) {
            throw new IllegalStateException(
                    "Missing required production credentials: " + String.join(", ", missing));
        }

        String jwtSecret = environment.getProperty("jwt.secret", "").trim();
        if (jwtSecret.getBytes(StandardCharsets.UTF_8).length < MINIMUM_JWT_SECRET_LENGTH) {
            throw new IllegalStateException("JWT_SECRET must contain at least 32 bytes in production");
        }

        if (StringUtils.hasText(environment.getProperty("CAMERA_DEMO_BYPASS_CODE"))) {
            throw new IllegalStateException("CAMERA_DEMO_BYPASS_CODE must not be set in production");
        }
    }

    private void requireText(String propertyName, String environmentName, List<String> missing) {
        if (!StringUtils.hasText(environment.getProperty(propertyName))) {
            missing.add(environmentName);
        }
    }
}
