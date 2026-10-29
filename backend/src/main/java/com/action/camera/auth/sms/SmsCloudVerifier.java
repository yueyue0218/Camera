package com.action.camera.auth.sms;

/** An SMS sender whose sent verification code is generated and verified by the provider. */
public interface SmsCloudVerifier {
    /** Returns false only for a definitive invalid code; provider errors must throw. */
    boolean verifyCode(String normalizedPhone, String code);
}
