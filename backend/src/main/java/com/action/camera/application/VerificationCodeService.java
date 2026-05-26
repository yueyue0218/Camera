package com.action.camera.application;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 邮箱验证码：生成、发邮件、校验。验证码存内存，5 分钟有效，60 秒冷却。
 */
@Service
public class VerificationCodeService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    private final ConcurrentHashMap<String, CodeEntry> store = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();

    private static final long CODE_TTL_MS = 5 * 60 * 1000;    // 验证码有效期 5 分钟
    private static final long RESEND_COOLDOWN_MS = 60 * 1000;  // 重发冷却 60 秒

    public VerificationCodeService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

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
        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setFrom(fromEmail);
        msg.setTo(to);
        msg.setSubject("【Camera 约拍】注册验证码");
        msg.setText("你的验证码是：" + code + "，5 分钟内有效。如非本人操作请忽略。");
        try {
            mailSender.send(msg);
        } catch (MailAuthenticationException e) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR,
                    "邮箱 SMTP 认证失败：请确认 application-local.yml 中 password 为 QQ 邮箱「授权码」（非登录密码），且已开启 SMTP 服务");
        } catch (MailException e) {
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