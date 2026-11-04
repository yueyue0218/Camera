package com.action.camera.auth.sms.dypns;

import com.action.camera.auth.config.SmsProperties;
import com.action.camera.auth.domain.SmsPurpose;
import com.action.camera.auth.sms.*;
import com.aliyun.dypnsapi20170525.Client;
import com.aliyun.dypnsapi20170525.models.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.*;
import org.mockito.ArgumentCaptor;
import java.time.Duration;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;

@ExtendWith(OutputCaptureExtension.class)
class DefaultSchemeLocalCodeSenderTest {
    SmsProperties properties() {
        var p=new SmsProperties(); p.setSignName("恒创联众"); p.setLoginTemplateId("100001");
        p.setReauthTemplateId("100001"); p.setReauthSchemeName("默认方案");
        return p;
    }
    @Test void bothPurposesSendActualCodeWithDefaultSchemeAndNeverCheck() throws Exception {
        Client client=mock(Client.class);
        when(client.sendSmsVerifyCode(any())).thenReturn(new SendSmsVerifyCodeResponse().setBody(
            new SendSmsVerifyCodeResponseBody().setSuccess(true).setCode("OK")));
        var sender=new DypnsSmsSender(properties(),new ObjectMapper(),client);
        for(var purpose : new SmsPurpose[]{SmsPurpose.LOGIN,SmsPurpose.REAUTH})
            sender.send(new SmsMessage("+8613800138000",purpose,"739182",Duration.ofMinutes(5)));
        var captured=ArgumentCaptor.forClass(SendSmsVerifyCodeRequest.class);
        verify(client,times(2)).sendSmsVerifyCode(captured.capture());
        for(var request:captured.getAllValues()) {
            assertThat(request.getSchemeName()).isEqualTo("默认方案");
            assertThat(request.getTemplateCode()).isEqualTo("100001");
            assertThat(new ObjectMapper().readTree(request.getTemplateParam()).get("code").asText()).isEqualTo("739182");
            assertThat(request.getReturnVerifyCode()).isFalse();
        }
        assertThat(sender).isNotInstanceOf(SmsCloudVerifier.class);
        assertThatThrownBy(() -> sender.verifyCode("+8613800138000","739182")).isInstanceOf(SmsDeliveryException.class);
        verify(client,never()).checkSmsVerifyCode(any());
    }
    @Test void untrustedProviderErrorCannotLogCode(CapturedOutput output) throws Exception {
        Client client=mock(Client.class);
        when(client.sendSmsVerifyCode(any())).thenReturn(new SendSmsVerifyCodeResponse().setBody(
            new SendSmsVerifyCodeResponseBody().setSuccess(false).setCode("isv.INVALID_PARAMETERS")
                .setMessage("TemplateParam code 739182 phone 13800138000 invalid")));
        var sender=new DypnsSmsSender(properties(),new ObjectMapper(),client);
        assertThatThrownBy(() -> sender.send(new SmsMessage("+8613800138000",SmsPurpose.REAUTH,"739182",Duration.ofMinutes(5))))
            .isInstanceOf(SmsDeliveryException.class).hasMessage("PNVS SMS send rejected");
        assertThat(output.getAll()).doesNotContain("739182","13800138000");
    }
}
