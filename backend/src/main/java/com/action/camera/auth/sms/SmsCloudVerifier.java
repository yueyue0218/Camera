package com.action.camera.auth.sms;

/** An SMS sender whose sent verification code is generated and verified by the provider. */
public interface SmsCloudVerifier {
    /** Returns false only for a definitive invalid code; provider errors must throw. */
    boolean verifyCode(String normalizedPhone, String code);

    default boolean verifyCode(String normalizedPhone, com.action.camera.auth.domain.SmsPurpose purpose, String code) {
        if (purpose != com.action.camera.auth.domain.SmsPurpose.LOGIN) {
            throw new SmsDeliveryException("Provider does not support this verification purpose");
        }
        return verifyCode(normalizedPhone, code);
    }
}
