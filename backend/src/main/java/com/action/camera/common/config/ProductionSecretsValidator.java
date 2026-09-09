package com.action.camera.common.config;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
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
        requireText("camera.sms.provider", "SMS_PROVIDER", missing);
        requireText("camera.sms.endpoint", "SMS_ENDPOINT", missing);
        requireText("camera.sms.access-key-id", "SMS_ACCESS_KEY_ID", missing);
        requireText("camera.sms.access-key-secret", "SMS_ACCESS_KEY_SECRET", missing);
        requireText("camera.sms.sign-name", "SMS_SIGN_NAME", missing);
        requireText("camera.sms.login-template-id", "SMS_LOGIN_TEMPLATE_ID", missing);
        requireText("camera.sms.code-pepper", "SMS_CODE_PEPPER", missing);
        requireText("camera.phone-identity.encryption-key", "PHONE_ENCRYPTION_KEY", missing);
        requireText("camera.phone-identity.lookup-hmac-key", "PHONE_LOOKUP_HMAC_KEY", missing);

        if (!missing.isEmpty()) {
            throw new IllegalStateException(
                    "Missing required production credentials: " + String.join(", ", missing));
        }

        String jwtSecret = environment.getProperty("jwt.secret", "").trim();
        if (jwtSecret.getBytes(StandardCharsets.UTF_8).length < MINIMUM_JWT_SECRET_LENGTH) {
            throw new IllegalStateException("JWT_SECRET must contain at least 32 bytes in production");
        }

        if (!"aliyun".equalsIgnoreCase(environment.getProperty("camera.sms.provider", ""))) {
            throw new IllegalStateException("SMS_PROVIDER must be aliyun in production");
        }

        validateBase64Key("camera.phone-identity.encryption-key", "PHONE_ENCRYPTION_KEY");
        validateBase64Key("camera.phone-identity.lookup-hmac-key", "PHONE_LOOKUP_HMAC_KEY");

        if (StringUtils.hasText(environment.getProperty("CAMERA_DEMO_BYPASS_CODE"))) {
            throw new IllegalStateException("CAMERA_DEMO_BYPASS_CODE must not be set in production");
        }
    }

    private void requireText(String propertyName, String environmentName, List<String> missing) {
        if (!StringUtils.hasText(environment.getProperty(propertyName))) {
            missing.add(environmentName);
        }
    }

    private void validateBase64Key(String propertyName, String environmentName) {
        try {
            byte[] decoded = Base64.getDecoder().decode(environment.getRequiredProperty(propertyName).trim());
            if (decoded.length != 32) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException(environmentName + " must be Base64 for exactly 32 bytes");
        }
    }
}
