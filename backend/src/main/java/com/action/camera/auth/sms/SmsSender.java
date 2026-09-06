package com.action.camera.auth.sms;

public interface SmsSender {

    SmsDeliveryReceipt send(SmsMessage message);
}
