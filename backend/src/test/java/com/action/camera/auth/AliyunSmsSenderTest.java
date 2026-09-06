package com.action.camera.auth;

import com.action.camera.auth.config.SmsProperties;
import com.action.camera.auth.domain.SmsPurpose;
import com.action.camera.auth.sms.SmsDeliveryException;
import com.action.camera.auth.sms.SmsMessage;
import com.action.camera.auth.sms.aliyun.AliyunSmsGateway;
import com.action.camera.auth.sms.aliyun.AliyunSmsResult;
import com.action.camera.auth.sms.aliyun.AliyunSmsSender;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AliyunSmsSenderTest {

    private AliyunSmsGateway gateway;
    private AliyunSmsSender sender;

    @BeforeEach
    void setUp() {
        SmsProperties properties = new SmsProperties();
        properties.setSignName("Approved Portra Sign");
        properties.setLoginTemplateId("SMS_123456789");
        gateway = mock(AliyunSmsGateway.class);
        sender = new AliyunSmsSender(gateway, properties, new ObjectMapper());
    }

    @Test
    void sendsLoginCodeAsAJsonStringAndAcceptsOnlyOkResponse() {
        when(gateway.send(
                "+8613800138000",
                "Approved Portra Sign",
                "SMS_123456789",
                "{\"code\":\"012345\"}"))
                .thenReturn(new AliyunSmsResult("OK", "request-id", "biz-id"));

        sender.send(new SmsMessage(
                "+8613800138000", SmsPurpose.LOGIN, "012345", Duration.ofMinutes(5)));

        verify(gateway).send(
                "+8613800138000",
                "Approved Portra Sign",
                "SMS_123456789",
                "{\"code\":\"012345\"}");
    }

    @Test
    void rejectsProviderLevelFailureWithoutExposingProviderMessage() {
        when(gateway.send(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(new AliyunSmsResult("isv.BUSINESS_LIMIT_CONTROL", "request-id", null));

        assertThatThrownBy(() -> sender.send(new SmsMessage(
                "+8613800138000", SmsPurpose.LOGIN, "123456", Duration.ofMinutes(5))))
                .isInstanceOf(SmsDeliveryException.class)
                .hasMessage("Alibaba Cloud SMS rejected the request")
                .message().doesNotContain("BUSINESS_LIMIT_CONTROL");
    }

    @Test
    void refusesPurposeWithoutAnApprovedTemplate() {
        assertThatThrownBy(() -> sender.send(new SmsMessage(
                "+8613800138000", SmsPurpose.REAUTH, "123456", Duration.ofMinutes(5))))
                .isInstanceOf(SmsDeliveryException.class)
                .hasMessageContaining("No Alibaba Cloud template");

        ArgumentCaptor<String> phone = ArgumentCaptor.forClass(String.class);
        verify(gateway, never()).send(
                phone.capture(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString());
        assertThat(phone.getAllValues()).isEmpty();
    }
}
