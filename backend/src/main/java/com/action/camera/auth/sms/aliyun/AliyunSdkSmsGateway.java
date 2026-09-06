package com.action.camera.auth.sms.aliyun;

import com.action.camera.auth.config.SmsProperties;
import com.action.camera.auth.sms.SmsDeliveryException;
import com.aliyun.dysmsapi20170525.Client;
import com.aliyun.dysmsapi20170525.models.SendSmsRequest;
import com.aliyun.dysmsapi20170525.models.SendSmsResponse;
import com.aliyun.teaopenapi.models.Config;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("prod")
public class AliyunSdkSmsGateway implements AliyunSmsGateway {

    private final Client client;

    public AliyunSdkSmsGateway(SmsProperties properties) {
        try {
            Config config = new Config()
                    .setAccessKeyId(properties.getAccessKeyId())
                    .setAccessKeySecret(properties.getAccessKeySecret())
                    .setEndpoint(properties.getEndpoint());
            this.client = new Client(config);
        } catch (Exception e) {
            throw new IllegalStateException("Unable to initialize Alibaba Cloud SMS client", e);
        }
    }

    @Override
    public AliyunSmsResult send(String phone,
                                String signName,
                                String templateCode,
                                String templateParameters) {
        SendSmsRequest request = new SendSmsRequest()
                .setPhoneNumbers(phone)
                .setSignName(signName)
                .setTemplateCode(templateCode)
                .setTemplateParam(templateParameters);
        try {
            SendSmsResponse response = client.sendSms(request);
            if (response == null || response.getBody() == null) {
                throw new SmsDeliveryException("Alibaba Cloud SMS returned an empty response");
            }
            return new AliyunSmsResult(
                    response.getBody().getCode(),
                    response.getBody().getRequestId(),
                    response.getBody().getBizId());
        } catch (SmsDeliveryException e) {
            throw e;
        } catch (Exception e) {
            throw new SmsDeliveryException("Alibaba Cloud SMS request failed", e);
        }
    }
}
