package com.action.camera.auth.service;

import com.action.camera.auth.config.SmsProperties;
import com.action.camera.auth.domain.SmsChallenge;
import com.action.camera.auth.domain.SmsDeliveryStatus;
import com.action.camera.auth.domain.SmsPurpose;
import com.action.camera.auth.repository.SmsChallengeRepository;
import com.action.camera.auth.sms.SmsDeliveryReceipt;
import com.action.camera.auth.dto.SmsChallengeResponse;
import org.springframework.transaction.annotation.Propagation;
import java.util.Objects;
import java.util.UUID;
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
import java.util.List;

@Service
public class PhoneSmsService {

    private static final String RATE_LIMIT_MESSAGE = "请求过于频繁，请稍后再试";
    private static final List<SmsDeliveryStatus> RESERVED_OR_SENT =
            List.of(SmsDeliveryStatus.PENDING, SmsDeliveryStatus.SENT);
    private static final List<SmsDeliveryStatus> FAILED = List.of(SmsDeliveryStatus.FAILED);

    private final SmsChallengeRepository challengeRepository;
    private final SmsSender smsSender;
    private final PhoneNumberNormalizer phoneNumberNormalizer;
    private final PhoneIdentityCodec phoneIdentityCodec;
    private final SmsCodeHasher codeHasher;
    private final SmsProperties properties;
    private final Clock clock;
    private final SecureRandom secureRandom;
    @Autowired private SmsChallengeLocks databaseLocks;

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

    // Legacy Java entry point is deliberately fail-closed; no latest-challenge fallback.
    @Deprecated
    public void sendCode(String rawPhone, SmsPurpose purpose, String requestIp, String deviceId) {
        throw new SmsCodeInvalidException();
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = SmsSendFailedException.class)
    public SmsChallengeResponse createChallenge(String rawPhone, SmsPurpose purpose, String requestIp,
            String deviceId, Long userId, String sessionId, String operation) {
        requireOwner(purpose, userId, sessionId, operation);
        if (purpose == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "验证码用途不能为空");
        }
        String phone = phoneNumberNormalizer.normalize(rawPhone);
        String phoneHash = phoneIdentityCodec.lookupHash(phone);
        String safeIp = requireContextValue(requestIp, 45, "请求来源无效");
        String safeDeviceId = requireContextValue(deviceId, 128, "设备标识不能为空");
        if (!SmsSendConcurrencyGuard.acquireUntilTransactionCompletion(phoneHash, safeIp, safeDeviceId)) {
            throw rateLimited("IN_FLIGHT");
        }
        databaseLocks.acquire("phone:"+phoneHash, "ip:"+safeIp, "device:"+safeDeviceId);
        LocalDateTime now = LocalDateTime.now(clock);

        // Retain the database row lock used by existing verification/send flows.
        challengeRepository.findFirstByPhoneHashAndPurposeOrderByCreatedAtDesc(phoneHash, purpose);
        // A newer FAILED row must not hide a recent successful send.
        if (challengeRepository.existsByPhoneHashAndPurposeAndDeliveryStatusInAndCreatedAtAfter(
                phoneHash, purpose, RESERVED_OR_SENT, now.minus(properties.getResendCooldown()))) {
            throw rateLimited("SEND_COOLDOWN");
        }
        if (challengeRepository.existsByPhoneHashAndPurposeAndDeliveryStatusInAndCreatedAtAfter(
                phoneHash, purpose, FAILED, now.minusSeconds(10))) {
            throw rateLimited("FAILURE_BACKOFF");
        }

        enforceRateLimits(phoneHash, safeIp, safeDeviceId, now);

        // Once a replacement is admitted, fail closed even if its delivery fails.
        for (SmsChallenge old : challengeRepository.findByPhoneHashAndPurposeAndConsumedAtIsNullAndInvalidatedAtIsNull(phoneHash, purpose)) {
            old.setInvalidatedAt(now);
        }
        String code = String.format("%06d", secureRandom.nextInt(1_000_000));
        SmsChallenge challenge = new SmsChallenge();
        challenge.setPhoneHash(phoneHash);
        challenge.setPurpose(purpose);
        challenge.setChallengeId(UUID.randomUUID().toString());
        challenge.setOwnerUserId(userId);
        challenge.setOwnerSessionId(sessionId);
        challenge.setOperation(operation);
        challenge.setCodeHash(codeHasher.hash(challenge, code));
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
        return new SmsChallengeResponse(challenge.getChallengeId(), challenge.getExpiresAt());
    }

    @Deprecated
    public String verifyCode(String rawPhone, SmsPurpose purpose, String code) {
        throw new SmsCodeInvalidException();
    }

    // Consumption and wrong-attempt counters survive rollback of any caller/business transaction.
    @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = SmsCodeInvalidException.class)
    public String consumeChallenge(String challengeId, String rawPhone, SmsPurpose purpose, String code,
            Long userId, String sessionId, String operation) {
        requireOwner(purpose, userId, sessionId, operation);
        if (challengeId == null || !challengeId.matches("[0-9a-f-]{36}")) throw new SmsCodeInvalidException();
        if (purpose == null || code == null || !code.matches("\\d{6}")) {
            throw new SmsCodeInvalidException();
        }
        String phone = phoneNumberNormalizer.normalize(rawPhone);
        String phoneHash = phoneIdentityCodec.lookupHash(phone);
        databaseLocks.acquire("phone:"+phoneHash);
        LocalDateTime now = LocalDateTime.now(clock);
        SmsChallenge challenge = challengeRepository
                .findByChallengeId(challengeId)
                .orElseThrow(SmsCodeInvalidException::new);

        if (!phoneHash.equals(challenge.getPhoneHash()) || purpose != challenge.getPurpose()
                || !Objects.equals(userId, challenge.getOwnerUserId())
                || !Objects.equals(sessionId, challenge.getOwnerSessionId())
                || !Objects.equals(operation, challenge.getOperation())
                || challenge.getInvalidatedAt() != null
                || challenge.getConsumedAt() != null
                || challenge.getDeliveryStatus() != SmsDeliveryStatus.SENT
                || !challenge.getExpiresAt().isAfter(now)
                || challenge.getAttemptCount() >= challenge.getMaxAttempts()) {
            throw new SmsCodeInvalidException();
        }

        boolean verified = codeHasher.matches(challenge, code);
        if (!verified) {
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

    private void requireOwner(SmsPurpose purpose, Long userId, String sessionId, String operation) {
        boolean login = purpose == SmsPurpose.LOGIN && userId == null && sessionId == null && "LOGIN".equals(operation);
        boolean reauth = purpose == SmsPurpose.REAUTH && userId != null && userId > 0
                && sessionId != null && sessionId.matches("[A-Za-z0-9_-]{1,128}") && "ACCOUNT_CLOSURE".equals(operation);
        if (!login && !reauth) throw new SmsCodeInvalidException();
    }

    private void enforceRateLimits(String phoneHash, String requestIp, String deviceId, LocalDateTime now) {
        LocalDateTime hourAgo = now.minusHours(1);
        LocalDateTime dayAgo = now.minusHours(24);
        checkLimit(challengeRepository.countByPhoneHashAndDeliveryStatusInAndCreatedAtAfter(phoneHash, RESERVED_OR_SENT, hourAgo),
                properties.getPhoneHourlyLimit(), "PHONE_HOURLY");
        checkLimit(challengeRepository.countByPhoneHashAndDeliveryStatusInAndCreatedAtAfter(phoneHash, RESERVED_OR_SENT, dayAgo),
                properties.getPhoneDailyLimit(), "PHONE_DAILY");
        checkLimit(challengeRepository.countByRequestIpAndDeliveryStatusInAndCreatedAtAfter(requestIp, RESERVED_OR_SENT, hourAgo),
                properties.getIpHourlyLimit(), "IP_HOURLY");
        checkLimit(challengeRepository.countByRequestIpAndDeliveryStatusInAndCreatedAtAfter(requestIp, RESERVED_OR_SENT, dayAgo),
                properties.getIpDailyLimit(), "IP_DAILY");
        checkLimit(challengeRepository.countByDeviceIdAndDeliveryStatusInAndCreatedAtAfter(deviceId, RESERVED_OR_SENT, hourAgo),
                properties.getDeviceHourlyLimit(), "DEVICE_HOURLY");
        checkLimit(challengeRepository.countByDeviceIdAndDeliveryStatusInAndCreatedAtAfter(deviceId, RESERVED_OR_SENT, dayAgo),
                properties.getDeviceDailyLimit(), "DEVICE_DAILY");

        // Failures have a separate rolling minute budget, never an hour/day penalty.
        LocalDateTime failureWindow = now.minusMinutes(1);
        checkLimit(challengeRepository.countByPhoneHashAndDeliveryStatusInAndCreatedAtAfter(phoneHash, FAILED, failureWindow),
                properties.getPhoneHourlyLimit(), "PHONE_FAILURE_BURST");
        checkLimit(challengeRepository.countByRequestIpAndDeliveryStatusInAndCreatedAtAfter(requestIp, FAILED, failureWindow),
                properties.getIpHourlyLimit(), "IP_FAILURE_BURST");
        checkLimit(challengeRepository.countByDeviceIdAndDeliveryStatusInAndCreatedAtAfter(deviceId, FAILED, failureWindow),
                properties.getDeviceHourlyLimit(), "DEVICE_FAILURE_BURST");
    }

    private void checkLimit(long count, long limit, String rule) {
        if (count >= limit) {
            throw rateLimited(rule);
        }
    }

    private String requireContextValue(String value, int maxLength, String message) {
        if (value == null || value.isBlank() || value.length() > maxLength) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, message);
        }
        return value.trim();
    }

    private BusinessException rateLimited(String rule) {
        org.slf4j.LoggerFactory.getLogger(PhoneSmsService.class).info("SMS_RATE_LIMIT rule={}", rule);
        return new BusinessException(ErrorCode.VALIDATION_ERROR, RATE_LIMIT_MESSAGE);
    }
}
