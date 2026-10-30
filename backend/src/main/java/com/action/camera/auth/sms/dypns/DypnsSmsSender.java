package com.action.camera.auth.sms.dypns;

import com.action.camera.auth.config.SmsProperties;
import com.action.camera.auth.domain.SmsPurpose;
import com.action.camera.auth.sms.SmsCloudVerifier;
import com.action.camera.auth.sms.SmsDeliveryException;
import com.action.camera.auth.sms.SmsDeliveryReceipt;
import com.action.camera.auth.sms.SmsMessage;
import com.action.camera.auth.sms.SmsSender;
import com.aliyun.dypnsapi20170525.Client;
import com.aliyun.dypnsapi20170525.models.CheckSmsVerifyCodeRequest;
import com.aliyun.dypnsapi20170525.models.CheckSmsVerifyCodeResponse;
import com.aliyun.dypnsapi20170525.models.SendSmsVerifyCodeRequest;
import com.aliyun.dypnsapi20170525.models.SendSmsVerifyCodeResponse;
import com.aliyun.teaopenapi.models.Config;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Map;

/** Staging-only adapter. Not a Spring component; installed by StagingSmsConfiguration. */
public final class DypnsSmsSender implements SmsSender, SmsCloudVerifier {
    private static final String PNVS_SCHEME_NAME = "默认方案";

    private final Client client;
    private final SmsProperties properties;
    private final ObjectMapper objectMapper;

    public DypnsSmsSender(SmsProperties properties, ObjectMapper objectMapper) {
        this(properties, objectMapper, createClient(properties));
    }

    // Allows tests to exercise the real SDK request serialization without any network access.
    DypnsSmsSender(SmsProperties properties, ObjectMapper objectMapper, Client client) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.client = client;
    }

    private static Client createClient(SmsProperties properties) {
        try {
            com.aliyun.credentials.models.Config credentialConfig = new com.aliyun.credentials.models.Config()
                    .setType("ecs_ram_role")
                    .setRoleName(properties.getDypnsRoleName())
                    .setDisableIMDSv1(true);
            com.aliyun.credentials.Client credentialClient = new com.aliyun.credentials.Client(credentialConfig);
            Config sdkConfig = new Config()
                    .setCredential(credentialClient)
                    .setEndpoint(properties.getDypnsEndpoint());
            return new Client(sdkConfig);
        } catch (Exception e) {
            throw new IllegalStateException("Unable to initialize PNVS SMS client with ECS RAM role");
        }
    }

    @Override
    public SmsDeliveryReceipt send(SmsMessage message) {
        if (message.purpose() != SmsPurpose.LOGIN && message.purpose() != SmsPurpose.REAUTH) {
            throw new SmsDeliveryException("Unsupported SMS purpose for PNVS");
        }
        String scheme = schemeFor(message.purpose());
        String template = message.purpose() == SmsPurpose.REAUTH ? properties.getReauthTemplateId() : properties.getLoginTemplateId();
        if (template == null || template.isBlank()) throw new SmsDeliveryException("No approved SMS template for purpose");
        // Important: The locally generated SmsMessage.code() is NOT sent or verified in this mode.
        // The cloud service owns the issued code when TemplateParam contains ##code##.
        final String templateParam;
        try {
            long minutes = properties.getCodeTtl().toMinutes();
            templateParam = objectMapper.writeValueAsString(Map.of("code", "##code##", "min", Long.toString(minutes)));
        } catch (JsonProcessingException e) {
            throw new SmsDeliveryException("Unable to serialize PNVS template parameters", e);
        }
        SendSmsVerifyCodeRequest request = new SendSmsVerifyCodeRequest()
                .setSchemeName(scheme)
                .setPhoneNumber(toDomesticPhone(message.phone()))
                .setCountryCode("86")
                .setSignName(properties.getSignName())
                .setTemplateCode(template)
                .setTemplateParam(templateParam)
                .setCodeType(1L)
                .setCodeLength(6L)
                .setValidTime(properties.getCodeTtl().toSeconds())
                .setDuplicatePolicy(1L)
                .setInterval(Math.max(1L, properties.getResendCooldown().toSeconds()))
                .setReturnVerifyCode(false);
        long started = System.nanoTime();
        try {
            SendSmsVerifyCodeResponse response = client.sendSmsVerifyCode(request);
            if (response == null || response.getBody() == null
                    || !Boolean.TRUE.equals(response.getBody().getSuccess())
                    || !"OK".equals(response.getBody().getCode())) {
                PnvsSendDiagnostics.rejected(request,
                        response == null || response.getBody() == null ? "NO_BODY" : response.getBody().getCode(),
                        response == null || response.getBody() == null ? null : response.getBody().getMessage(),
                        PnvsSendDiagnostics.requestId(
                                response == null || response.getBody() == null ? null : response.getBody().getRequestId(),
                                response == null ? null : response.getHeaders()),
                        response == null ? null : response.getStatusCode(), properties.getDypnsEndpoint(), elapsedMs(started));
                throw new SmsDeliveryException("PNVS SMS send rejected");
            }
            String bizId = response.getBody().getModel() == null
                    ? null : response.getBody().getModel().getBizId();
            return new SmsDeliveryReceipt(bizId);
        } catch (SmsDeliveryException e) {
            throw e;
        } catch (Exception e) {
            if (e instanceof com.aliyun.tea.TeaException sdk) {
                Object requestId = sdk.getData() == null ? null : sdk.getData().get("RequestId");
                if (requestId == null && sdk.getData() != null) {
                    requestId = sdk.getData().get("requestId");
                }
                PnvsSendDiagnostics.rejected(request, sdk.getCode(), sdk.getMessage(), requestId,
                        sdk.getStatusCode(), properties.getDypnsEndpoint(), elapsedMs(started));
            } else {
                org.slf4j.LoggerFactory.getLogger(DypnsSmsSender.class).warn(
                        "PNVS_SEND_EXCEPTION type={} providerElapsedMs={}", e.getClass().getName(), elapsedMs(started));
                PnvsSendDiagnostics.rejected(request, null, null, null, null,
                        properties.getDypnsEndpoint(), elapsedMs(started));
            }
            // SDK exception chains may contain sensitive request or credential details.
            throw new SmsDeliveryException("PNVS SMS send failed");
        }
    }

    private String schemeFor(SmsPurpose purpose) {
        if (purpose == SmsPurpose.LOGIN) return PNVS_SCHEME_NAME;
        String scheme = properties.getReauthSchemeName();
        if (purpose != SmsPurpose.REAUTH || scheme == null || scheme.isBlank() || PNVS_SCHEME_NAME.equals(scheme)) {
            throw new SmsDeliveryException("A separate approved PNVS reauthentication scheme is required");
        }
        return scheme;
    }

    @Override
    public boolean verifyCode(String normalizedPhone, String code) {
        return verifyCode(normalizedPhone, SmsPurpose.LOGIN, code);
    }

    @Override
    public boolean verifyCode(String normalizedPhone, SmsPurpose purpose, String code) {
        CheckSmsVerifyCodeRequest request = new CheckSmsVerifyCodeRequest()
                .setSchemeName(schemeFor(purpose))
                .setPhoneNumber(toDomesticPhone(normalizedPhone))
                .setVerifyCode(code);
        try {
            CheckSmsVerifyCodeResponse response = client.checkSmsVerifyCode(request);
            if (response == null || response.getBody() == null
                    || !Boolean.TRUE.equals(response.getBody().getSuccess())
                    || !"OK".equals(response.getBody().getCode())
                    || response.getBody().getModel() == null) {
                throw new SmsDeliveryException("PNVS SMS verification unavailable");
            }
            String result = response.getBody().getModel().getVerifyResult();
            if ("PASS".equals(result)) {
                return true;
            }
            if ("UNKNOWN".equals(result)) {
                return false;
            }
            // Missing/unrecognized provider data is not a wrong user code.
            throw new SmsDeliveryException("PNVS SMS verification returned an invalid result");
        } catch (SmsDeliveryException e) {
            throw e;
        } catch (Exception e) {
            throw new SmsDeliveryException("PNVS SMS verification failed");
        }
    }

    private static long elapsedMs(long started) {
        return java.util.concurrent.TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started);
    }

    private static String toDomesticPhone(String normalizedPhone) {
        if (normalizedPhone == null ||
                !normalizedPhone.matches("\\+861[3-9]\\d{9}")) {
            throw new SmsDeliveryException(
                    "PNVS requires a mainland China mobile number");
        }
        return normalizedPhone.substring(3);
    }
}
