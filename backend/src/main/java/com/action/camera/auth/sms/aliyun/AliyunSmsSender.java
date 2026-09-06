package com.action.camera.auth.sms.aliyun;

import com.action.camera.auth.config.SmsProperties;
import com.action.camera.auth.domain.SmsPurpose;
import com.action.camera.auth.sms.SmsDeliveryException;
import com.action.camera.auth.sms.SmsDeliveryReceipt;
import com.action.camera.auth.sms.SmsMessage;
import com.action.camera.auth.sms.SmsSender;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@Profile("prod")
public class AliyunSmsSender implements SmsSender {

    private final AliyunSmsGateway gateway;
    private final SmsProperties properties;
    private final ObjectMapper objectMapper;

    public AliyunSmsSender(AliyunSmsGateway gateway,
                           SmsProperties properties,
                           ObjectMapper objectMapper) {
        this.gateway = gateway;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    @Override
    public SmsDeliveryReceipt send(SmsMessage message) {
        if (message.purpose() != SmsPurpose.LOGIN) {
            throw new SmsDeliveryException("No Alibaba Cloud template configured for SMS purpose");
        }

        AliyunSmsResult result = gateway.send(
                message.phone(),
                properties.getSignName(),
                properties.getLoginTemplateId(),
                templateParameters(message.code()));
        if (result == null || !"OK".equals(result.code())) {
            throw new SmsDeliveryException("Alibaba Cloud SMS rejected the request");
        }
        return new SmsDeliveryReceipt(result.bizId());
    }

    private String templateParameters(String code) {
        try {
            return objectMapper.writeValueAsString(Map.of("code", code));
        } catch (JsonProcessingException e) {
            throw new SmsDeliveryException("Unable to serialize SMS template parameters", e);
        }
    }
}
