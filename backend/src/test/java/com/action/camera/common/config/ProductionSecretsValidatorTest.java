package com.action.camera.common.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProductionSecretsValidatorTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(ProductionSecretsValidator.class);

    @Test
    void prodProfileFailsApplicationStartupWhenCredentialsAreMissing() {
        contextRunner
                .withPropertyValues("spring.profiles.active=prod")
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure())
                            .hasRootCauseMessage("Missing required production credentials: "
                                    + "SPRING_DATASOURCE_PASSWORD/DB_PASSWORD, SPRING_MAIL_USERNAME, "
                                    + "SPRING_MAIL_PASSWORD, JWT_SECRET, SMS_PROVIDER, SMS_ENDPOINT, "
                                    + "SMS_ACCESS_KEY_ID, SMS_ACCESS_KEY_SECRET, SMS_SIGN_NAME, "
                                    + "SMS_LOGIN_TEMPLATE_ID, SMS_CODE_PEPPER");
                });
    }

    @Test
    void nonProductionProfileDoesNotInstallProductionValidator() {
        contextRunner.run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context).doesNotHaveBean(ProductionSecretsValidator.class);
        });
    }

    @Test
    void acceptsExternallySuppliedProductionCredentials() {
        MockEnvironment environment = completeEnvironment();

        assertThatCode(() -> new ProductionSecretsValidator(environment).afterPropertiesSet())
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsMissingProductionCredentials() {
        MockEnvironment environment = new MockEnvironment();

        assertThatThrownBy(() -> new ProductionSecretsValidator(environment).afterPropertiesSet())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("SPRING_DATASOURCE_PASSWORD/DB_PASSWORD")
                .hasMessageContaining("SPRING_MAIL_USERNAME")
                .hasMessageContaining("SPRING_MAIL_PASSWORD")
                .hasMessageContaining("JWT_SECRET")
                .hasMessageContaining("SMS_PROVIDER")
                .hasMessageContaining("SMS_ENDPOINT")
                .hasMessageContaining("SMS_ACCESS_KEY_ID")
                .hasMessageContaining("SMS_ACCESS_KEY_SECRET")
                .hasMessageContaining("SMS_SIGN_NAME")
                .hasMessageContaining("SMS_LOGIN_TEMPLATE_ID")
                .hasMessageContaining("SMS_CODE_PEPPER");
    }

    @Test
    void rejectsWeakProductionJwtSecret() {
        MockEnvironment environment = completeEnvironment()
                .withProperty("jwt.secret", "too-short");

        assertThatThrownBy(() -> new ProductionSecretsValidator(environment).afterPropertiesSet())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("at least 32 bytes");
    }

    @Test
    void rejectsDemoVerificationBypassInProduction() {
        MockEnvironment environment = completeEnvironment()
                .withProperty("CAMERA_DEMO_BYPASS_CODE", "123456");

        assertThatThrownBy(() -> new ProductionSecretsValidator(environment).afterPropertiesSet())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("must not be set in production");
    }

    @Test
    void rejectsDemoProfilesInProduction() {
        MockEnvironment environment = completeEnvironment();
        environment.setActiveProfiles("prod", "smoke");

        assertThatThrownBy(() -> new ProductionSecretsValidator(environment).afterPropertiesSet())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("must not run with dev or smoke profiles");
    }

    private MockEnvironment completeEnvironment() {
        return new MockEnvironment()
                .withProperty("spring.datasource.password", "external-database-password")
                .withProperty("spring.mail.username", "external-mail-user")
                .withProperty("spring.mail.password", "external-mail-password")
                .withProperty("jwt.secret", "external-jwt-secret-with-at-least-32-characters")
                .withProperty("camera.sms.provider", "aliyun")
                .withProperty("camera.sms.endpoint", "dysmsapi.aliyuncs.com")
                .withProperty("camera.sms.access-key-id", "external-ram-access-key-id")
                .withProperty("camera.sms.access-key-secret", "external-ram-access-key-secret")
                .withProperty("camera.sms.sign-name", "approved-sign-name")
                .withProperty("camera.sms.login-template-id", "SMS_123456789")
                .withProperty("camera.sms.code-pepper", "external-sms-code-pepper-with-sufficient-entropy");
    }
}
