package com.action.camera.application;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.security.SecureRandom;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 邮箱验证码：生成、发邮件、校验。验证码存内存，5 分钟有效，60 秒冷却。
 * 使用 Resend HTTP API 发信（绕过 Railway 的 SMTP 封锁）。
 */
@Service
public class VerificationCodeService {

    @Value("${camera.mail.from:onboarding@resend.dev}")
    private String fromEmail;

    @Value("${RESEND_API_KEY:}")
    private String resendApiKey;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ConcurrentHashMap<String, CodeEntry> store = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();

    private static final long CODE_TTL_MS = 5 * 60 * 1000;
    private static final long RESEND_COOLDOWN_MS = 60 * 1000;

    /** 生成验证码并发邮件 */
    public void sendCode(String email) {
        long now = System.currentTimeMillis();
        CodeEntry existing = store.get(email);
        if (existing != null && now - existing.sentAt < RESEND_COOLDOWN_MS) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "发送过于频繁，请稍后再试");
        }
        String code = String.format("%06d", random.nextInt(1_000_000));
        sendEmail(email, code);
        store.put(email, new CodeEntry(code, now + CODE_TTL_MS, now));
    }

    /** 校验验证码；成功后删除（一次性使用） */
    public void verify(String email, String code) {
        CodeEntry entry = store.get(email);
        if (entry == null || System.currentTimeMillis() > entry.expireAt) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "验证码已过期，请重新获取");
        }
        if (!entry.code.equals(code)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "验证码错误");
        }
        store.remove(email);
    }

    private void sendEmail(String to, String code) {
        if (resendApiKey == null || resendApiKey.isEmpty()) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "邮件服务未配置，请联系管理员");
        }
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(resendApiKey);

            Map<String, Object> body = Map.of(
                    "from", "Portra约拍 <" + fromEmail + ">",
                    "to", List.of(to),
                    "subject", "【Portra约拍】注册验证码",
                    "text", "你的验证码是：" + code + "，5 分钟内有效。如非本人操作请忽略。"
            );

            restTemplate.postForEntity(
                    "https://api.resend.com/emails",
                    new HttpEntity<>(body, headers),
                    String.class
            );
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "邮件发送失败: " + e.getMessage());
        }
    }

    private static class CodeEntry {
        final String code;
        final long expireAt;
        final long sentAt;
        CodeEntry(String code, long expireAt, long sentAt) {
            this.code = code;
            this.expireAt = expireAt;
            this.sentAt = sentAt;
        }
    }
}
