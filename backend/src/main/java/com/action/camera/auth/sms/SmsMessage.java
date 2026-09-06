package com.action.camera.auth.sms;

import com.action.camera.auth.domain.SmsPurpose;

import java.time.Duration;

public record SmsMessage(
        String phone,
        SmsPurpose purpose,
        String code,
        Duration expiresIn
) {
}
