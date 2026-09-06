package com.action.camera.auth.service;

import com.action.camera.auth.config.SmsProperties;
import com.action.camera.auth.domain.SmsPurpose;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

@Component
public class SmsCodeHasher {

    private static final String HMAC_ALGORITHM = "HmacSHA256";

    private final SmsProperties properties;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    public SmsCodeHasher(SmsProperties properties) {
        this.properties = properties;
    }

    public String hash(String phone, SmsPurpose purpose, String code) {
        return encoder.encode(pepperedDigest(phone, purpose, code));
    }

    public boolean matches(String phone, SmsPurpose purpose, String code, String encodedHash) {
        return encoder.matches(pepperedDigest(phone, purpose, code), encodedHash);
    }

    private String pepperedDigest(String phone, SmsPurpose purpose, String code) {
        String pepper = properties.getCodePepper();
        if (!StringUtils.hasText(pepper)) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "短信服务暂不可用");
        }
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(pepper.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
            byte[] digest = mac.doFinal((phone + "\n" + purpose.name() + "\n" + code)
                    .getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            throw new IllegalStateException("Unable to initialize SMS code hashing", e);
        }
    }
}
