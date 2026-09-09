package com.action.camera.auth.service;

import com.action.camera.auth.config.SmsProperties;
import com.action.camera.auth.domain.SmsChallenge;
import com.action.camera.auth.domain.SmsDeliveryStatus;
import com.action.camera.auth.domain.SmsPurpose;
import com.action.camera.auth.repository.SmsChallengeRepository;
import com.action.camera.auth.sms.SmsDeliveryReceipt;
import com.action.camera.auth.sms.SmsMessage;
import com.action.camera.auth.sms.SmsSender;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Optional;

@Service
public class PhoneSmsService {

    private static final String RATE_LIMIT_MESSAGE = "请求过于频繁，请稍后再试";

    private final SmsChallengeRepository challengeRepository;
    private final SmsSender smsSender;
    private final PhoneNumberNormalizer phoneNumberNormalizer;
    private final PhoneIdentityCodec phoneIdentityCodec;
    private final SmsCodeHasher codeHasher;
    private final SmsProperties properties;
    private final Clock clock;
    private final SecureRandom secureRandom;

    @Autowired
    public PhoneSmsService(SmsChallengeRepository challengeRepository,
                           SmsSender smsSender,
                           PhoneNumberNormalizer phoneNumberNormalizer,
                           PhoneIdentityCodec phoneIdentityCodec,
                           SmsCodeHasher codeHasher,
                           SmsProperties properties) {
        this(challengeRepository, smsSender, phoneNumberNormalizer, phoneIdentityCodec, codeHasher, properties,
                Clock.systemDefaultZone(), new SecureRandom());
    }

    PhoneSmsService(SmsChallengeRepository challengeRepository,
                    SmsSender smsSender,
                    PhoneNumberNormalizer phoneNumberNormalizer,
                    PhoneIdentityCodec phoneIdentityCodec,
                    SmsCodeHasher codeHasher,
                    SmsProperties properties,
                    Clock clock,
                    SecureRandom secureRandom) {
        this.challengeRepository = challengeRepository;
        this.smsSender = smsSender;
        this.phoneNumberNormalizer = phoneNumberNormalizer;
        this.phoneIdentityCodec = phoneIdentityCodec;
        this.codeHasher = codeHasher;
        this.properties = properties;
        this.clock = clock;
        this.secureRandom = secureRandom;
    }

    @Transactional(noRollbackFor = SmsSendFailedException.class)
    public void sendCode(String rawPhone, SmsPurpose purpose, String requestIp, String deviceId) {
        if (purpose == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "验证码用途不能为空");
        }
        String phone = phoneNumberNormalizer.normalize(rawPhone);
        String phoneHash = phoneIdentityCodec.lookupHash(phone);
        String safeIp = requireContextValue(requestIp, 45, "请求来源无效");
        String safeDeviceId = requireContextValue(deviceId, 128, "设备标识不能为空");
        LocalDateTime now = LocalDateTime.now(clock);

        Optional<SmsChallenge> latest = challengeRepository
                .findFirstByPhoneHashAndPurposeOrderByCreatedAtDesc(phoneHash, purpose);
        if (latest.isPresent()
                && latest.get().getCreatedAt().isAfter(now.minus(properties.getResendCooldown()))) {
            throw rateLimited();
        }

        enforceRateLimits(phoneHash, safeIp, safeDeviceId, now);

        String code = String.format("%06d", secureRandom.nextInt(1_000_000));
        SmsChallenge challenge = new SmsChallenge();
        challenge.setPhoneHash(phoneHash);
        challenge.setPurpose(purpose);
        challenge.setCodeHash(codeHasher.hash(phone, purpose, code));
        challenge.setExpiresAt(now.plus(properties.getCodeTtl()));
        challenge.setAttemptCount(0);
        challenge.setMaxAttempts(properties.getMaxAttempts());
        challenge.setRequestIp(safeIp);
        challenge.setDeviceId(safeDeviceId);
        challenge.setDeliveryStatus(SmsDeliveryStatus.PENDING);
        challenge.setCreatedAt(now);
        challengeRepository.saveAndFlush(challenge);

        try {
            SmsDeliveryReceipt receipt = smsSender.send(
                    new SmsMessage(phone, purpose, code, properties.getCodeTtl()));
            challenge.setDeliveryStatus(SmsDeliveryStatus.SENT);
            challenge.setProviderMessageId(receipt == null ? null : receipt.providerMessageId());
            challenge.setSentAt(now);
            challengeRepository.saveAndFlush(challenge);
        } catch (RuntimeException e) {
            challenge.setDeliveryStatus(SmsDeliveryStatus.FAILED);
            challenge.setExpiresAt(now);
            challengeRepository.saveAndFlush(challenge);
            throw new SmsSendFailedException();
        }
    }

    @Transactional(noRollbackFor = SmsCodeInvalidException.class)
    public String verifyCode(String rawPhone, SmsPurpose purpose, String code) {
        if (purpose == null || code == null || !code.matches("\\d{6}")) {
            throw new SmsCodeInvalidException();
        }
        String phone = phoneNumberNormalizer.normalize(rawPhone);
        String phoneHash = phoneIdentityCodec.lookupHash(phone);
        LocalDateTime now = LocalDateTime.now(clock);
        SmsChallenge challenge = challengeRepository
                .findFirstByPhoneHashAndPurposeOrderByCreatedAtDesc(phoneHash, purpose)
                .orElseThrow(SmsCodeInvalidException::new);

        if (challenge.getConsumedAt() != null
                || challenge.getDeliveryStatus() != SmsDeliveryStatus.SENT
                || !challenge.getExpiresAt().isAfter(now)
                || challenge.getAttemptCount() >= challenge.getMaxAttempts()) {
            throw new SmsCodeInvalidException();
        }

        if (!codeHasher.matches(phone, purpose, code, challenge.getCodeHash())) {
            challenge.setAttemptCount(challenge.getAttemptCount() + 1);
            challenge.setLastAttemptAt(now);
            challengeRepository.saveAndFlush(challenge);
            throw new SmsCodeInvalidException();
        }

        challenge.setConsumedAt(now);
        challenge.setLastAttemptAt(now);
        challengeRepository.saveAndFlush(challenge);
        return phone;
    }

    private void enforceRateLimits(String phoneHash, String requestIp, String deviceId, LocalDateTime now) {
        LocalDateTime hourAgo = now.minusHours(1);
        LocalDateTime dayAgo = now.minusHours(24);
        if (challengeRepository.countByPhoneHashAndCreatedAtAfter(phoneHash, hourAgo)
                >= properties.getPhoneHourlyLimit()
                || challengeRepository.countByPhoneHashAndCreatedAtAfter(phoneHash, dayAgo)
                >= properties.getPhoneDailyLimit()
                || challengeRepository.countByRequestIpAndCreatedAtAfter(requestIp, hourAgo)
                >= properties.getIpHourlyLimit()
                || challengeRepository.countByRequestIpAndCreatedAtAfter(requestIp, dayAgo)
                >= properties.getIpDailyLimit()
                || challengeRepository.countByDeviceIdAndCreatedAtAfter(deviceId, hourAgo)
                >= properties.getDeviceHourlyLimit()
                || challengeRepository.countByDeviceIdAndCreatedAtAfter(deviceId, dayAgo)
                >= properties.getDeviceDailyLimit()) {
            throw rateLimited();
        }
    }

    private String requireContextValue(String value, int maxLength, String message) {
        if (value == null || value.isBlank() || value.length() > maxLength) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, message);
        }
        return value.trim();
    }

    private BusinessException rateLimited() {
        return new BusinessException(ErrorCode.VALIDATION_ERROR, RATE_LIMIT_MESSAGE);
    }
}
