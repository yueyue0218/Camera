package com.action.camera.auth;

import com.action.camera.auth.service.PhoneNumberNormalizer;
import com.action.camera.common.exception.BusinessException;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PhoneNumberNormalizerTest {

    private final PhoneNumberNormalizer normalizer = new PhoneNumberNormalizer();

    @ParameterizedTest
    @ValueSource(strings = {
            "13800138000",
            "86 138-0013-8000",
            "+86 138 0013 8000",
            "0086-138-0013-8000"
    })
    void normalizesMainlandNumbersToE164(String input) {
        assertThat(normalizer.normalize(input)).isEqualTo("+8613800138000");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "",
            "12345",
            "12800138000",
            "+0123456789",
            "+861380013800012345"
    })
    void rejectsInvalidNumbers(String input) {
        assertThatThrownBy(() -> normalizer.normalize(input))
                .isInstanceOf(BusinessException.class)
                .hasMessage("手机号格式不正确");
    }
}
