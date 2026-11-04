package com.action.camera.auth.config;

import com.action.camera.auth.sms.DisabledSmsSender;
import com.action.camera.auth.sms.SmsSender;
import com.action.camera.auth.sms.aliyun.AliyunSdkSmsGateway;
import com.action.camera.auth.sms.aliyun.AliyunSmsSender;
import com.action.camera.auth.sms.dypns.DypnsSmsSender;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

/** Staging opts in independently of the existing production/dev sender rules. */
@Configuration(proxyBeanMethods = false)
@Profile("(staging | temp-staging) & !prod")
public class StagingSmsConfiguration {

    @Bean
    public SmsSender stagingSmsSender(SmsProperties properties, Environment environment,
                                      ObjectMapper objectMapper) {
        if (environment.acceptsProfiles(Profiles.of("dev", "smoke"))) {
            throw new IllegalStateException("Staging must not run with dev or smoke profiles");
        }
        if (properties.isStagingAliyunEnabled() && properties.isStagingDypnsEnabled()) {
            throw new IllegalStateException("Enable only one staging SMS provider (dysms or dypns)");
        }
        if (!properties.isStagingAliyunEnabled() && !properties.isStagingDypnsEnabled()) {
            LoggerFactory.getLogger(StagingSmsConfiguration.class).info("Staging SMS sender: disabled");
            return new DisabledSmsSender();
        }

        // Shared identity and SMS challenge protection is required for either real sender.
        validateKey(environment.getProperty("camera.phone-identity.encryption-key"), "PHONE_ENCRYPTION_KEY");
        validateKey(environment.getProperty("camera.phone-identity.lookup-hmac-key"), "PHONE_LOOKUP_HMAC_KEY");
        if (properties.getCodeTtl() == null || properties.getCodeTtl().isZero()
                || properties.getCodeTtl().isNegative() || properties.getResendCooldown() == null
                || properties.getResendCooldown().isZero() || properties.getResendCooldown().isNegative()) {
            throw new IllegalStateException("SMS_CODE_TTL and SMS_RESEND_COOLDOWN must be positive");
        }
        if (properties.isStagingDypnsEnabled()) {
            List<String> missing = new ArrayList<>();
            requireConfigured(properties.getSignName(), "SMS_SIGN_NAME", missing);
            requireConfigured(properties.getLoginTemplateId(), "SMS_LOGIN_TEMPLATE_ID", missing);
            requireConfigured(properties.getDypnsEndpoint(), "SMS_DYPNS_ENDPOINT", missing);
            requireConfigured(properties.getDypnsRoleName(), "SMS_DYPNS_ROLE_NAME", missing);
            requireConfigured(properties.getCodePepper(), "SMS_CODE_PEPPER", missing);
            if (!missing.isEmpty()) {
                throw new IllegalStateException("Missing staging PNVS configuration: " + String.join(", ", missing));
            }
            if (!"dypns".equalsIgnoreCase(properties.getProvider())) {
                throw new IllegalStateException("SMS_PROVIDER must be dypns when staging PNVS is enabled");
            }
            if (properties.getCodeTtl().getSeconds() % 60 != 0 || properties.getCodeTtl().getSeconds() > 3600) {
                throw new IllegalStateException("PNVS template minutes and ValidTime must agree");
            }
            LoggerFactory.getLogger(StagingSmsConfiguration.class).info("Staging SMS sender: PNVS via ECS RAM role");
            return new DypnsSmsSender(properties, objectMapper);
        }

        List<String> missing = new ArrayList<>();
        requireConfigured(properties.getAccessKeyId(), "SMS_ACCESS_KEY_ID", missing);
        requireConfigured(properties.getAccessKeySecret(), "SMS_ACCESS_KEY_SECRET", missing);
        requireConfigured(properties.getSignName(), "SMS_SIGN_NAME", missing);
        requireConfigured(properties.getLoginTemplateId(), "SMS_LOGIN_TEMPLATE_ID", missing);
        requireConfigured(properties.getEndpoint(), "SMS_ENDPOINT", missing);
        requireConfigured(properties.getCodeParameterName(), "SMS_CODE_PARAMETER_NAME", missing);
        requireConfigured(properties.getCodePepper(), "SMS_CODE_PEPPER", missing);
        if (!missing.isEmpty()) {
            throw new IllegalStateException("Missing staging SMS configuration: " + String.join(", ", missing));
        }
        if (!"aliyun".equalsIgnoreCase(properties.getProvider())) {
            throw new IllegalStateException("SMS_PROVIDER must be aliyun when staging SMS is enabled");
        }
        validateKey(environment.getProperty("camera.phone-identity.encryption-key"), "PHONE_ENCRYPTION_KEY");
        validateKey(environment.getProperty("camera.phone-identity.lookup-hmac-key"), "PHONE_LOOKUP_HMAC_KEY");
        if (properties.getCodeTtl() == null || properties.getCodeTtl().isZero()
                || properties.getCodeTtl().isNegative() || properties.getResendCooldown() == null
                || properties.getResendCooldown().isZero() || properties.getResendCooldown().isNegative()) {
            throw new IllegalStateException("SMS_CODE_TTL and SMS_RESEND_COOLDOWN must be positive");
        }

        SmsSender sender = new AliyunSmsSender(new AliyunSdkSmsGateway(properties), properties, objectMapper);
        LoggerFactory.getLogger(StagingSmsConfiguration.class).info("Staging SMS sender: aliyun");
        return sender;
    }

    private static void requireConfigured(String value, String name, List<String> missing) {
        if (value == null || value.isBlank() || value.trim().startsWith("REPLACE_ME")) {
            missing.add(name);
        }
    }

    private static void validateKey(String value, String name) {
        try {
            if (value == null || Base64.getDecoder().decode(value.trim()).length != 32) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException(name + " must be Base64 for exactly 32 bytes");
        }
    }
}
