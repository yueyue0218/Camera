package com.action.camera.auth;

import com.action.camera.auth.sms.SmsDeliveryException;
import com.action.camera.auth.sms.dypns.DypnsSmsSender;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Pure format regression: no SDK client or credentials provider is constructed. */
class DypnsPhoneFormatTest {
    @Test
    void mainlandE164IsConvertedToElevenDigits() {
        String phone = ReflectionTestUtils.invokeMethod(DypnsSmsSender.class,
                "toDomesticPhone", "+8613800138000");
        assertThat(phone).isEqualTo("13800138000");
    }

    @Test
    void nonMainlandNumberIsRejected() {
        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(DypnsSmsSender.class,
                "toDomesticPhone", "+85291234567")).isInstanceOf(SmsDeliveryException.class);
    }
}
