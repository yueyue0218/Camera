package com.action.camera.auth.sms.dypns;

import com.action.camera.auth.config.SmsProperties;
import com.action.camera.auth.domain.SmsPurpose;
import com.action.camera.auth.sms.SmsDeliveryException;
import com.action.camera.auth.sms.SmsMessage;
import com.aliyun.dypnsapi20170525.Client;
import com.aliyun.dypnsapi20170525.models.SendSmsVerifyCodeRequest;
import com.aliyun.dypnsapi20170525.models.SendSmsVerifyCodeResponse;
import com.action.camera.auth.service.PhoneNumberNormalizer;
import com.aliyun.teaopenapi.models.Config;
import com.aliyun.teaopenapi.models.OpenApiRequest;
import com.aliyun.teaopenapi.models.Params;
import com.aliyun.teautil.models.RuntimeOptions;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.MockedConstruction;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.mockConstruction;

@ExtendWith(OutputCaptureExtension.class)
class DypnsSmsSenderTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private CapturingClient client;
    private DypnsSmsSender sender;

    @BeforeEach
    void setUp() throws Exception {
        client = new CapturingClient();
        SmsProperties properties = new SmsProperties();
        properties.setSignName("恒创联众");
        properties.setLoginTemplateId("100001");
        sender = new DypnsSmsSender(properties, mapper, client);
    }

    @Test
    void realSdkSerializesSendParametersWithoutCallingNetworkOrCredentials() throws Exception {
        assertThat(sender.send(new SmsMessage("+8613800138000", SmsPurpose.LOGIN,
                "654321", Duration.ofMinutes(5))).providerMessageId()).isEqualTo("mock-biz");
        assertThat(client.params.getAction()).isEqualTo("SendSmsVerifyCode");
        assertThat(client.params.getVersion()).isEqualTo("2017-05-25");
        assertThat(client.params.getMethod()).isEqualTo("POST");
        assertThat(client.params.getProtocol()).isEqualTo("HTTPS");
        assertThat(client.query).containsEntry("PhoneNumber", "13800138000")
                .containsEntry("CountryCode", "86").containsEntry("SignName", "恒创联众")
                .containsEntry("TemplateCode", "100001").containsEntry("CodeType", "1")
                .containsEntry("CodeLength", "6").containsEntry("ValidTime", "300")
                .containsEntry("DuplicatePolicy", "1").containsEntry("Interval", "60")
                .containsEntry("ReturnVerifyCode", "false");
        assertThat(mapper.readTree(client.query.get("TemplateParam")))
                .isEqualTo(mapper.readTree("{\"code\":\"##code##\",\"min\":\"5\"}"));
        assertThat(client.query).containsEntry("SchemeName", "默认方案").hasSize(12)
                .doesNotContainKeys("AutoRetry", "AccessKeyId", "SecurityToken");
        assertThat(client.query.get("TemplateParam")).doesNotContain("654321");
        assertThat(client.query.get("PhoneNumber")).matches("[0-9]{11}");
        assertThat(client.lastSend.getCodeLength()).isInstanceOf(Long.class);
        assertThat(client.lastSend.getReturnVerifyCode()).isInstanceOf(Boolean.class);
        assertThat(client.lastSend.getSchemeName()).isEqualTo("\u9ED8\u8BA4\u65B9\u6848");
        assertThat(client._credential).isSameAs(client.credentials);
        verifyNoInteractions(client.credentials);
    }

    @Test
    void realSdkDistinguishesOmittedAndEmptySchemeWithoutChangingOtherParameters() throws Exception {
        sender.send(new SmsMessage("+8613800138000", SmsPurpose.LOGIN, "654321", Duration.ofMinutes(5)));
        Map<String, String> explicitEmpty = new HashMap<>(client.query);
        client.sendSmsVerifyCode(client.lastSend.setSchemeName(null));
        Map<String, String> omitted = new HashMap<>(client.query);
        client.sendSmsVerifyCode(client.lastSend.setSchemeName(""));
        assertThat(explicitEmpty.remove("SchemeName")).isEqualTo("默认方案");
        assertThat(explicitEmpty).isEqualTo(omitted);
        assertThat(com.aliyun.openapiutil.Client.toForm(omitted)).doesNotContain("SchemeName");
        // The form helper drops empty strings, so it must not be mistaken for URL serialization.
        assertThat(com.aliyun.openapiutil.Client.toForm(client.query)).doesNotContain("SchemeName");
        com.aliyun.tea.TeaRequest httpRequest = new com.aliyun.tea.TeaRequest();
        httpRequest.protocol = "https";
        httpRequest.pathname = "/";
        httpRequest.headers = Map.of("host", "dypnsapi.aliyuncs.com");
        httpRequest.query = omitted;
        String omittedUrl = org.springframework.test.util.ReflectionTestUtils.invokeMethod(
                com.aliyun.tea.Tea.class, "composeUrl", httpRequest);
        httpRequest.query = client.query;
        String emptyUrl = org.springframework.test.util.ReflectionTestUtils.invokeMethod(
                com.aliyun.tea.Tea.class, "composeUrl", httpRequest);
        assertThat(omittedUrl).doesNotContain("SchemeName");
        assertThat(emptyUrl).contains("SchemeName=");
    }

    @ParameterizedTest
    @ValueSource(strings = {"13800138000", "+8613800138000", "008613800138000", "86 13800138000", "138 0013-8000"})
    void normalizerOutputBecomesSameDomesticSdkField(String rawPhone) {
        String normalized = new PhoneNumberNormalizer().normalize(rawPhone);
        sender.send(new SmsMessage(normalized, SmsPurpose.LOGIN, "654321", Duration.ofMinutes(5)));
        assertThat(client.query.get("PhoneNumber")).isEqualTo("13800138000");
        assertThat(client.query.get("CountryCode")).isEqualTo("86");
    }

    @Test
    void rejectedResponseLogsSafeMetadataAndHeaderRequestId(CapturedOutput output) {
        client.code = "isv.INVALID_PARAMETERS";
        client.responseMessage = "invalid PhoneNumber parameters 13800138000 +8613800138000 "
                + "code=654321 AccessKeySecret=secret-value SecurityToken=token-value\nFORGED_LOG";
        client.responseRequestId = null;
        client.headers = Map.of("X-Acs-Request-Id", "12345678-abcd-4321-aaaa-123456789abc");
        assertThatThrownBy(() -> sender.send(new SmsMessage("+8613800138000", SmsPurpose.LOGIN,
                "654321", Duration.ofMinutes(5)))).isInstanceOf(SmsDeliveryException.class);
        assertThat(output.getOut()).contains("code=isv.INVALID_PARAMETERS", "message=invalid PhoneNumber parameters",
                "requestId=12345678-abcd-4321-aaaa-123456789abc", "phoneLength=11", "phoneDigitsOnly=true",
                "phoneMainlandFormat=true", "countryCode=86", "schemeState=NONEMPTY", "codeLength=6",
                "validTime=300", "interval=60", "duplicatePolicy=1", "returnVerifyCode=false");
        assertThat(output.getAll()).doesNotContain("13800138000", "654321", "secret-value", "token-value", "FORGED_LOG");
        assertThat(output.getAll()).containsPattern("providerElapsedMs=\\d+");
    }

    @Test
    void sdkErrorLogsSafeMessageAndRequestIdWithoutExceptionDetails(CapturedOutput output) {
        var error = new com.aliyun.tea.TeaException();
        error.setCode("isv.INVALID_PARAMETERS");
        error.setMessage("invalid TemplateParam 13800138000 654321 credential-secret");
        error.setStatusCode(400);
        error.setData(Map.of("RequestId", "12345678-abcd-4321-aaaa-123456789abc"));
        client.failure = error;
        assertThatThrownBy(() -> sender.send(new SmsMessage("+8613800138000", SmsPurpose.LOGIN,
                "654321", Duration.ofMinutes(5)))).isInstanceOf(SmsDeliveryException.class).hasNoCause();
        assertThat(output.getAll()).contains("message=invalid TemplateParam", "httpStatus=400",
                "requestId=12345678-abcd-4321-aaaa-123456789abc");
        assertThat(output.getAll()).doesNotContain("13800138000", "654321", "credential-secret");
    }

    @Test
    void diagnosticProjectionSuppressesUnrecognizedAndEncodedSecrets() {
        assertThat(PnvsSendDiagnostics.safeMessage("13800138000 %2B8613800138000 654321 "
                + "LTAIsecret credential:YWJjZGVm\r\nInjected")).isEqualTo("REDACTED");
        assertThat(PnvsSendDiagnostics.safeRequestId("13800138000 secret")).isEqualTo("UNAVAILABLE_OR_REDACTED");
        assertThat(PnvsSendDiagnostics.safeCode("isv.INVALID_PARAMETERS\nsecret")).isEqualTo("REDACTED");
    }

    @Test
    void productionConstructorWiresEcsRoleProviderWithoutStaticKeys() {
        SmsProperties properties = new SmsProperties();
        properties.setDypnsRoleName("test-ecs-role");
        try (MockedConstruction<com.aliyun.credentials.Client> credentials = mockConstruction(
                com.aliyun.credentials.Client.class, (mock, context) -> {
                    var config = (com.aliyun.credentials.models.Config) context.arguments().get(0);
                    assertThat(config.getType()).isEqualTo("ecs_ram_role");
                    assertThat(config.getRoleName()).isEqualTo("test-ecs-role");
                    assertThat(config.getDisableIMDSv1()).isTrue();
                });
             MockedConstruction<Client> sdk = mockConstruction(Client.class, (mock, context) -> {
                 Config config = (Config) context.arguments().get(0);
                 assertThat(config.getEndpoint()).isEqualTo("dypnsapi.aliyuncs.com");
                 assertThat(config.getCredential()).isSameAs(credentials.constructed().get(0));
                 assertThat(config.getAccessKeyId()).isNull();
                 assertThat(config.getAccessKeySecret()).isNull();
             })) {
            new DypnsSmsSender(properties, mapper);
            assertThat(credentials.constructed()).hasSize(1);
            assertThat(sdk.constructed()).hasSize(1);
            verifyNoInteractions(credentials.constructed().get(0), sdk.constructed().get(0));
        }
    }

    @Test
    void realSdkSerializesVerificationForSameDomesticPhone() {
        assertThat(sender.verifyCode("+8613800138000", "123456")).isTrue();
        assertThat(client.params.getAction()).isEqualTo("CheckSmsVerifyCode");
        assertThat(client.query).containsExactlyInAnyOrderEntriesOf(
                Map.of("PhoneNumber", "13800138000", "VerifyCode", "123456", "SchemeName", "默认方案"));
        com.aliyun.tea.TeaRequest request = new com.aliyun.tea.TeaRequest();
        request.protocol = "https";
        request.pathname = "/";
        request.headers = Map.of("host", "dypnsapi.aliyuncs.com");
        request.query = client.query;
        String url = org.springframework.test.util.ReflectionTestUtils.invokeMethod(
                com.aliyun.tea.Tea.class, "composeUrl", request);
        assertThat(url).contains("SchemeName=");
    }

    @Test
    void reauthenticationRequiresSeparateApprovedSchemeAndUsesItForSendAndVerify() {
        SmsProperties properties=new SmsProperties(); properties.setSignName("Approved sign");
        properties.setLoginTemplateId("LOGIN_TEMPLATE"); properties.setReauthTemplateId("REAUTH_TEMPLATE");
        DypnsSmsSender configured=new DypnsSmsSender(properties,mapper,client);
        assertThatThrownBy(()->configured.send(new SmsMessage("+8613800138000",SmsPurpose.REAUTH,"123456",Duration.ofMinutes(5))))
                .isInstanceOf(SmsDeliveryException.class).hasMessageContaining("separate approved PNVS");
        properties.setReauthSchemeName("默认方案");
        assertThatThrownBy(()->configured.verifyCode("+8613800138000",SmsPurpose.REAUTH,"123456"))
                .isInstanceOf(SmsDeliveryException.class);
        properties.setReauthSchemeName("portra-identity-reauth");
        assertThat(configured.send(new SmsMessage("+8613800138000",SmsPurpose.REAUTH,"123456",Duration.ofMinutes(5))).providerMessageId())
                .isEqualTo("mock-biz");
        assertThat(client.query).containsEntry("SchemeName","portra-identity-reauth").containsEntry("TemplateCode","REAUTH_TEMPLATE");
        assertThat(configured.verifyCode("+8613800138000",SmsPurpose.REAUTH,"123456")).isTrue();
        assertThat(client.query).containsEntry("SchemeName","portra-identity-reauth");
        assertThat(configured.verifyCode("+8613800138000","123456")).isTrue();
        assertThat(client.query).containsEntry("SchemeName","默认方案");
    }

    @Test
    void documentedUnknownResultMeansInvalidCode() {
        client.verifyResult = "UNKNOWN";
        assertThat(sender.verifyCode("+8613800138000", "123456")).isFalse();
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"UNEXPECTED", "FAIL"})
    void malformedResultIsProviderFailureNotWrongUserCode(String result) {
        client.verifyResult = result;
        assertThatThrownBy(() -> sender.verifyCode("+8613800138000", "123456"))
                .isInstanceOf(SmsDeliveryException.class);
    }

    @Test
    void providerSystemErrorCannotBecomeSendSuccess() {
        client.code = "isp.SYSTEM_ERROR";
        assertThatThrownBy(() -> sender.send(new SmsMessage("+8613800138000", SmsPurpose.LOGIN,
                "123456", Duration.ofMinutes(5)))).isInstanceOf(SmsDeliveryException.class);
    }

    @Test
    void sdkExceptionDetailsAreNotRetained() {
        client.failure = new IllegalStateException("sensitive-provider-request");
        assertThatThrownBy(() -> sender.send(new SmsMessage("+8613800138000", SmsPurpose.LOGIN,
                "123456", Duration.ofMinutes(5)))).isInstanceOf(SmsDeliveryException.class)
                .hasNoCause().hasMessage("PNVS SMS send failed");
        assertThatThrownBy(() -> sender.verifyCode("+8613800138000", "123456"))
                .isInstanceOf(SmsDeliveryException.class).hasNoCause()
                .hasMessage("PNVS SMS verification failed");
    }

    /** Runs the installed generated SDK through query serialization; stops before signing/HTTP. */
    private static final class CapturingClient extends Client {
        final com.aliyun.credentials.Client credentials;
        Params params;
        Map<String, String> query;
        String code = "OK";
        String verifyResult = "PASS";
        RuntimeException failure;
        SendSmsVerifyCodeRequest lastSend;
        String responseMessage = "OK";
        String responseRequestId = "mock-request";
        Map<String, String> headers = Map.of();

        CapturingClient() throws Exception {
            this(mock(com.aliyun.credentials.Client.class));
        }

        private CapturingClient(com.aliyun.credentials.Client credentials) throws Exception {
            super(new Config().setCredential(credentials).setEndpoint("dypnsapi.aliyuncs.com"));
            this.credentials = credentials;
        }

        @Override
        public SendSmsVerifyCodeResponse sendSmsVerifyCode(SendSmsVerifyCodeRequest request) throws Exception {
            lastSend = request;
            return super.sendSmsVerifyCode(request);
        }

        @Override
        public Map<String, ?> callApi(Params params, OpenApiRequest request, RuntimeOptions runtime) {
            this.params = params;
            this.query = new HashMap<>(request.getQuery());
            if (failure != null) {
                throw failure;
            }
            Map<String, Object> model = new HashMap<>();
            model.put("BizId", "mock-biz");
            if (verifyResult != null) {
                model.put("VerifyResult", verifyResult);
            }
            Map<String, Object> body = new HashMap<>();
            body.put("Success", "OK".equals(code));
            body.put("Code", code);
            body.put("Message", responseMessage);
            body.put("Model", model);
            if (responseRequestId != null) {
                body.put("RequestId", responseRequestId);
            }
            return Map.of("statusCode", 200, "headers", headers, "body", body);
        }
    }
}
