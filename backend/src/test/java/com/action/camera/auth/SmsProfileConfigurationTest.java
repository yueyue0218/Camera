package com.action.camera.auth;

import com.action.camera.auth.config.*;
import com.action.camera.auth.sms.*;
import com.action.camera.auth.sms.aliyun.*;
import com.action.camera.auth.sms.dypns.DypnsSmsSender;
import com.action.camera.common.config.ProductionSecretsValidator;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.SystemEnvironmentPropertySource;
import org.springframework.core.io.FileSystemResource;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class SmsProfileConfigurationTest {
    @Configuration(proxyBeanMethods=false)
    @EnableConfigurationProperties(SmsProperties.class)
    static class Binding {}

    private ApplicationContextRunner context(String profiles, Map<String,Object> overrides) {
        Map<String,Object> values=new HashMap<>(Map.of(
            "PHONE_ENCRYPTION_KEY","MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
            "PHONE_LOOKUP_HMAC_KEY","YWJjZGVmMDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODk=",
            "SMS_SIGN_NAME","test-sign", "SMS_LOGIN_TEMPLATE_ID","login-template",
            "SMS_ACCESS_KEY_ID","fixture-key", "SMS_ACCESS_KEY_SECRET","fixture-secret",
            "SMS_CODE_PEPPER","fixture-pepper", "SMS_PROVIDER","aliyun"));
        values.putAll(overrides);
        return new ApplicationContextRunner().withUserConfiguration(Binding.class, StagingSmsConfiguration.class,
            DisabledSmsSender.class,DevSmsSender.class,AliyunSmsSender.class,AliyunSdkSmsGateway.class,
            ProductionSecretsValidator.class, com.action.camera.tempstaging.TempStagingWebConfig.class)
            .withBean(ObjectMapper.class,ObjectMapper::new)
            .withPropertyValues("spring.profiles.active="+profiles,
                "spring.datasource.password=fixture","spring.mail.username=fixture","spring.mail.password=fixture",
                "jwt.secret=fixture-only-012345678901234567890123456789")
            .withInitializer(ctx -> {
                // Isolate binding matrix from host CAMERA_SMS_* overrides.
                ctx.getEnvironment().getPropertySources().remove("systemEnvironment");
                ctx.getEnvironment().getPropertySources().addFirst(new SystemEnvironmentPropertySource("fixture-env",values));
                try {
                    for(var source:new YamlPropertySourceLoader().load("actual-main-yaml",new FileSystemResource("src/main/resources/application.yml")))
                        ctx.getEnvironment().getPropertySources().addLast(source);
                } catch(Exception e) { throw new IllegalStateException(e); }
            });
    }
    @Test void shortEnvironmentNamesBindThroughActualApplicationYaml() {
        context("",Map.of("SMS_STAGING_DYPNS_ENABLED","true","SMS_DYPNS_ROLE_NAME","role-fixture",
            "SMS_DYPNS_ENDPOINT","dypnsapi.aliyuncs.com","SMS_REAUTH_TEMPLATE_ID","reauth-fixture",
            "SMS_REAUTH_SCHEME_NAME","reauth-scheme")).run(ctx -> {
                assertThat(ctx).hasNotFailed(); var p=ctx.getBean(SmsProperties.class);
                assertThat(p.isStagingDypnsEnabled()).isTrue(); assertThat(p.getDypnsRoleName()).isEqualTo("role-fixture");
                assertThat(p.getDypnsEndpoint()).isEqualTo("dypnsapi.aliyuncs.com");
                assertThat(p.getReauthTemplateId()).isEqualTo("reauth-fixture");
                assertThat(p.getReauthSchemeName()).isEqualTo("reauth-scheme");
            });
    }
    @Test void profileProviderMatrixNeverSendsRealSms() {
        try(var sdk=mockConstruction(com.aliyun.dysmsapi20170525.Client.class);
            var pnvs=mockConstruction(com.aliyun.dypnsapi20170525.Client.class);
            var credentials=mockConstruction(com.aliyun.credentials.Client.class)) {
            for(String profile:List.of("staging","temp-staging")) {
                context(profile,Map.of()).run(c -> assertThat(c.getBean(SmsSender.class)).isInstanceOf(DisabledSmsSender.class));
                context(profile,Map.of("SMS_STAGING_ALIYUN_ENABLED","true"))
                    .run(c -> assertThat(c.getBean(SmsSender.class)).isInstanceOf(AliyunSmsSender.class));
                context(profile,Map.of("SMS_PROVIDER","dypns","SMS_STAGING_DYPNS_ENABLED","true","SMS_DYPNS_ROLE_NAME","role"))
                    .run(c -> assertThat(c.getBean(SmsSender.class)).isInstanceOf(DypnsSmsSender.class));
                context(profile,Map.of("SMS_STAGING_ALIYUN_ENABLED","true","SMS_STAGING_DYPNS_ENABLED","true"))
                    .run(c -> assertThat(c).hasFailed());
                context(profile,Map.of("SMS_PROVIDER","dypns","SMS_STAGING_DYPNS_ENABLED","true"))
                    .run(c -> assertThat(c).hasFailed());
                context(profile,Map.of("SMS_PROVIDER","dypns","SMS_STAGING_ALIYUN_ENABLED","true"))
                    .run(c -> assertThat(c).hasFailed());
            }
            context("prod",Map.of()).run(c -> assertThat(c.getBean(SmsSender.class)).isInstanceOf(AliyunSmsSender.class));
            context("prod",Map.of("SMS_PROVIDER","dypns")).run(c -> assertThat(c).hasFailed());
            for(String profile:List.of("dev","smoke")) context(profile,Map.of("SMS_PROVIDER","dypns"))
                .run(c -> assertThat(c.getBean(SmsSender.class)).isInstanceOf(DevSmsSender.class));
            for(String profiles:List.of("prod,dev","prod,staging","staging,dev","temp-staging,smoke"))
                context(profiles,Map.of()).run(c -> assertThat(c).hasFailed());
            context("",Map.of()).run(c -> assertThat(c.getBean(SmsSender.class)).isInstanceOf(DisabledSmsSender.class));
            sdk.constructed().forEach(org.mockito.Mockito::verifyNoInteractions);
            pnvs.constructed().forEach(org.mockito.Mockito::verifyNoInteractions);
            credentials.constructed().forEach(org.mockito.Mockito::verifyNoInteractions);
        }
    }
    @Test void tempStagingBlockerExistsOnlyWhenBothRealSendersAreDisabled() {
        try(var sdk=mockConstruction(com.aliyun.dysmsapi20170525.Client.class)) {
            context("temp-staging",Map.of()).run(c -> assertThat(c).hasSingleBean(com.action.camera.tempstaging.TempStagingWebConfig.class));
            context("temp-staging",Map.of("SMS_STAGING_ALIYUN_ENABLED","true"))
                .run(c -> assertThat(c).doesNotHaveBean(com.action.camera.tempstaging.TempStagingWebConfig.class));
            sdk.constructed().forEach(org.mockito.Mockito::verifyNoInteractions);
        }
    }
}
