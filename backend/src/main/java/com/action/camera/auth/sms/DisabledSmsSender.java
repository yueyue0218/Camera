package com.action.camera.auth.sms;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("!prod & !dev & !smoke")
public class DisabledSmsSender implements SmsSender {

    @Override
    public SmsDeliveryReceipt send(SmsMessage message) {
        throw new SmsDeliveryException("SMS sender is disabled outside an explicit runtime profile");
    }
}
