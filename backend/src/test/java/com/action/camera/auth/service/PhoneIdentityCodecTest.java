package com.action.camera.auth.service;

import com.action.camera.auth.config.PhoneIdentityProperties;
import com.action.camera.common.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PhoneIdentityCodecTest {

    private PhoneIdentityCodec codec;

    @BeforeEach
    void setUp() {
        PhoneIdentityProperties properties = new PhoneIdentityProperties();
        properties.setEncryptionKey("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=");
        properties.setLookupHmacKey("YWJjZGVmMDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODk=");
        codec = new PhoneIdentityCodec(properties);
    }

    @Test
    void producesStableLookupHashAndRandomAuthenticatedCiphertext() {
        PhoneIdentityCodec.PhoneIdentity first = codec.encode("+8613800138000");
        PhoneIdentityCodec.PhoneIdentity second = codec.encode("+8613800138000");

        assertThat(first.hash()).hasSize(64).isEqualTo(second.hash());
        assertThat(first.cipher()).isNotEqualTo(second.cipher());
        assertThat(codec.decrypt(first.cipher())).isEqualTo("+8613800138000");
        assertThat(first.masked()).doesNotContain("13800138000").endsWith("8000");
    }

    @Test
    void rejectsTamperedCiphertextWithoutExposingCryptoDetails() {
        byte[] ciphertext = codec.encode("+8613800138000").cipher().clone();
        ciphertext[ciphertext.length - 1] ^= 1;

        assertThatThrownBy(() -> codec.decrypt(ciphertext))
                .isInstanceOf(BusinessException.class)
                .hasMessage("手机号身份服务暂不可用");
    }
}
