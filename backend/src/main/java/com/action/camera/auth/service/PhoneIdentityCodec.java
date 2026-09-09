package com.action.camera.auth.service;

import com.action.camera.auth.config.PhoneIdentityProperties;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import java.util.HexFormat;

@Component
public class PhoneIdentityCodec {

    private static final byte ENVELOPE_VERSION = 1;
    private static final int NONCE_LENGTH = 12;
    private static final int GCM_TAG_BITS = 128;
    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final String CIPHER_ALGORITHM = "AES/GCM/NoPadding";

    private final PhoneIdentityProperties properties;
    private final SecureRandom secureRandom;

    @Autowired
    public PhoneIdentityCodec(PhoneIdentityProperties properties) {
        this(properties, new SecureRandom());
    }

    PhoneIdentityCodec(PhoneIdentityProperties properties, SecureRandom secureRandom) {
        this.properties = properties;
        this.secureRandom = secureRandom;
    }

    public PhoneIdentity encode(String normalizedPhone) {
        requirePhone(normalizedPhone);
        return new PhoneIdentity(encrypt(normalizedPhone), lookupHash(normalizedPhone), mask(normalizedPhone));
    }

    public String lookupHash(String normalizedPhone) {
        requirePhone(normalizedPhone);
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(decodeKey(properties.getLookupHmacKey()), HMAC_ALGORITHM));
            return HexFormat.of().formatHex(mac.doFinal(normalizedPhone.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw unavailable();
        }
    }

    public String decrypt(byte[] envelope) {
        if (envelope == null || envelope.length <= 1 + NONCE_LENGTH || envelope[0] != ENVELOPE_VERSION) {
            throw unavailable();
        }
        try {
            byte[] nonce = Arrays.copyOfRange(envelope, 1, 1 + NONCE_LENGTH);
            byte[] ciphertext = Arrays.copyOfRange(envelope, 1 + NONCE_LENGTH, envelope.length);
            Cipher cipher = Cipher.getInstance(CIPHER_ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE,
                    new SecretKeySpec(decodeKey(properties.getEncryptionKey()), "AES"),
                    new GCMParameterSpec(GCM_TAG_BITS, nonce));
            cipher.updateAAD(new byte[]{ENVELOPE_VERSION});
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException e) {
            throw unavailable();
        }
    }

    private byte[] encrypt(String normalizedPhone) {
        try {
            byte[] nonce = new byte[NONCE_LENGTH];
            secureRandom.nextBytes(nonce);
            Cipher cipher = Cipher.getInstance(CIPHER_ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE,
                    new SecretKeySpec(decodeKey(properties.getEncryptionKey()), "AES"),
                    new GCMParameterSpec(GCM_TAG_BITS, nonce));
            cipher.updateAAD(new byte[]{ENVELOPE_VERSION});
            byte[] ciphertext = cipher.doFinal(normalizedPhone.getBytes(StandardCharsets.UTF_8));
            return ByteBuffer.allocate(1 + nonce.length + ciphertext.length)
                    .put(ENVELOPE_VERSION).put(nonce).put(ciphertext).array();
        } catch (GeneralSecurityException e) {
            throw unavailable();
        }
    }

    private byte[] decodeKey(String value) {
        if (!StringUtils.hasText(value)) {
            throw unavailable();
        }
        try {
            byte[] decoded = Base64.getDecoder().decode(value.trim());
            if (decoded.length != 32) {
                throw unavailable();
            }
            return decoded;
        } catch (IllegalArgumentException e) {
            throw unavailable();
        }
    }

    private String mask(String normalizedPhone) {
        int tailStart = Math.max(1, normalizedPhone.length() - 4);
        int prefixEnd = Math.max(1, tailStart - 4);
        return normalizedPhone.substring(0, prefixEnd) + "****" + normalizedPhone.substring(tailStart);
    }

    private void requirePhone(String value) {
        if (!StringUtils.hasText(value) || !value.startsWith("+")) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "手机号格式不正确");
        }
    }

    private BusinessException unavailable() {
        return new BusinessException(ErrorCode.INTERNAL_ERROR, "手机号身份服务暂不可用");
    }

    public record PhoneIdentity(byte[] cipher, String hash, String masked) {
    }
}
