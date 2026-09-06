package com.action.camera.auth.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

@Component
public class PhoneNumberNormalizer {

    private static final Pattern SEPARATORS = Pattern.compile("[\\s()-]");
    private static final Pattern MAINLAND_NUMBER = Pattern.compile("1[3-9]\\d{9}");
    private static final Pattern E164 = Pattern.compile("\\+[1-9]\\d{7,14}");

    public String normalize(String rawPhone) {
        if (rawPhone == null || rawPhone.isBlank()) {
            throw invalidPhone();
        }

        String compact = SEPARATORS.matcher(rawPhone.trim()).replaceAll("");
        if (compact.startsWith("00")) {
            compact = "+" + compact.substring(2);
        }
        if (MAINLAND_NUMBER.matcher(compact).matches()) {
            compact = "+86" + compact;
        } else if (compact.startsWith("86")
                && MAINLAND_NUMBER.matcher(compact.substring(2)).matches()) {
            compact = "+" + compact;
        }

        if (!E164.matcher(compact).matches()) {
            throw invalidPhone();
        }
        return compact;
    }

    private BusinessException invalidPhone() {
        return new BusinessException(ErrorCode.VALIDATION_ERROR, "手机号格式不正确");
    }
}
