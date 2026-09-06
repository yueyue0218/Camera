package com.action.camera.auth.sms;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile({"dev", "smoke"})
public class DevSmsSender implements SmsSender {

    private static final Logger log = LoggerFactory.getLogger(DevSmsSender.class);

    @Override
    public SmsDeliveryReceipt send(SmsMessage message) {
        log.info("Development SMS code for {} ({}): {}",
                maskPhone(message.phone()), message.purpose(), message.code());
        return new SmsDeliveryReceipt("dev-local");
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 8) {
            return "***";
        }
        return phone.substring(0, 3) + "******" + phone.substring(phone.length() - 4);
    }
}
