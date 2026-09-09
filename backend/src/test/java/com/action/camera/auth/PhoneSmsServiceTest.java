package com.action.camera.auth;

import com.action.camera.auth.domain.SmsChallenge;
import com.action.camera.auth.domain.SmsDeliveryStatus;
import com.action.camera.auth.domain.SmsPurpose;
import com.action.camera.auth.repository.SmsChallengeRepository;
import com.action.camera.auth.service.PhoneSmsService;
import com.action.camera.auth.service.PhoneIdentityCodec;
import com.action.camera.auth.service.SmsCodeHasher;
import com.action.camera.auth.service.SmsCodeInvalidException;
import com.action.camera.auth.sms.SmsDeliveryException;
import com.action.camera.auth.sms.SmsDeliveryReceipt;
import com.action.camera.auth.sms.SmsMessage;
import com.action.camera.auth.sms.SmsSender;
import com.action.camera.common.exception.BusinessException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:phone_sms_service_test;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;NON_KEYWORDS=CURRENT_ROLE;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "camera.sms.code-pepper=phone-sms-service-test-pepper-never-production",
        "camera.sms.resend-cooldown=60s",
        "camera.sms.phone-hourly-limit=1",
        "camera.sms.phone-daily-limit=20",
        "camera.sms.ip-hourly-limit=1",
        "camera.sms.ip-daily-limit=100",
        "camera.sms.device-hourly-limit=1",
        "camera.sms.device-daily-limit=50"
})
class PhoneSmsServiceTest {

    private static final String PHONE = "+8613800138000";
    private static final String IP = "203.0.113.10";
    private static final String DEVICE = "device-b2-primary";

    @Autowired
    private PhoneSmsService phoneSmsService;

    @Autowired
    private SmsChallengeRepository challengeRepository;

    @Autowired
    private SmsCodeHasher codeHasher;

    @Autowired
    private PhoneIdentityCodec phoneIdentityCodec;

    @MockBean
    private SmsSender smsSender;

    @BeforeEach
    void setUp() {
        challengeRepository.deleteAll();
        reset(smsSender);
        when(smsSender.send(any(SmsMessage.class)))
                .thenReturn(new SmsDeliveryReceipt("test-provider-message-id"));
    }

    @AfterEach
    void cleanUp() {
        challengeRepository.deleteAll();
    }

    @Test
    void sendNormalizesPhoneAndPersistsOnlyHashedCode() {
        phoneSmsService.sendCode("138 0013-8000", SmsPurpose.LOGIN, IP, DEVICE);

        SmsMessage message = captureSingleMessage();
        SmsChallenge challenge = onlyChallenge();
        assertThat(message.phone()).isEqualTo(PHONE);
        assertThat(message.code()).matches("\\d{6}");
        assertThat(challenge.getPhoneHash()).isEqualTo(phoneIdentityCodec.lookupHash(PHONE));
        assertThat(challenge.getPhoneHash()).doesNotContain(PHONE);
        assertThat(challenge.getCodeHash()).doesNotContain(message.code());
        assertThat(codeHasher.matches(PHONE, SmsPurpose.LOGIN, message.code(), challenge.getCodeHash())).isTrue();
        assertThat(challenge.getDeliveryStatus()).isEqualTo(SmsDeliveryStatus.SENT);
        assertThat(challenge.getProviderMessageId()).isEqualTo("test-provider-message-id");
        assertThat(challenge.getSentAt()).isNotNull();
        assertThat(challenge.getExpiresAt()).isAfter(challenge.getCreatedAt().plusMinutes(4));
        assertThat(challenge.getMaxAttempts()).isEqualTo(5);
    }

    @Test
    void senderFailureLeavesAnUnusableRateLimitedChallenge() {
        when(smsSender.send(any(SmsMessage.class)))
                .thenThrow(new SmsDeliveryException("provider unavailable"));

        assertThatThrownBy(() -> phoneSmsService.sendCode(PHONE, SmsPurpose.LOGIN, IP, DEVICE))
                .isInstanceOf(BusinessException.class)
                .hasMessage("短信暂时无法发送，请稍后重试");
        SmsChallenge failed = onlyChallenge();
        assertThat(failed.getDeliveryStatus()).isEqualTo(SmsDeliveryStatus.FAILED);
        assertThat(failed.getExpiresAt()).isBeforeOrEqualTo(LocalDateTime.now());
        assertThat(failed.getSentAt()).isNull();
    }

    @Test
    void resendCooldownRejectsImmediateSecondRequest() {
        phoneSmsService.sendCode(PHONE, SmsPurpose.LOGIN, IP, DEVICE);

        assertThatThrownBy(() -> phoneSmsService.sendCode(PHONE, SmsPurpose.LOGIN, IP, DEVICE))
                .isInstanceOf(BusinessException.class)
                .hasMessage("请求过于频繁，请稍后再试");
        verify(smsSender, times(1)).send(any(SmsMessage.class));
    }

    @Test
    void hourlyLimitAppliesIndependentlyToPhoneIpAndDevice() {
        saveHistorical(PHONE, "198.51.100.1", "old-device-1");
        assertRateLimited(PHONE, "198.51.100.2", "new-device-1");

        challengeRepository.deleteAll();
        saveHistorical("+8613900139000", IP, "old-device-2");
        assertRateLimited("+8613700137000", IP, "new-device-2");

        challengeRepository.deleteAll();
        saveHistorical("+8613900139000", "198.51.100.3", DEVICE);
        assertRateLimited("+8613700137000", "198.51.100.4", DEVICE);
    }

    @Test
    void correctCodeIsConsumedOnce() {
        phoneSmsService.sendCode(PHONE, SmsPurpose.LOGIN, IP, DEVICE);
        String code = captureSingleMessage().code();

        assertThat(phoneSmsService.verifyCode(PHONE, SmsPurpose.LOGIN, code)).isEqualTo(PHONE);
        assertThat(onlyChallenge().getConsumedAt()).isNotNull();
        assertThatThrownBy(() -> phoneSmsService.verifyCode(PHONE, SmsPurpose.LOGIN, code))
                .isInstanceOf(SmsCodeInvalidException.class)
                .hasMessage("验证码无效或已过期");
    }

    @Test
    void wrongCodeIncrementsAttemptsEvenThoughRequestFails() {
        phoneSmsService.sendCode(PHONE, SmsPurpose.LOGIN, IP, DEVICE);
        String correctCode = captureSingleMessage().code();
        String wrongCode = correctCode.equals("999999") ? "888888" : "999999";

        assertThatThrownBy(() -> phoneSmsService.verifyCode(PHONE, SmsPurpose.LOGIN, wrongCode))
                .isInstanceOf(SmsCodeInvalidException.class);
        assertThat(onlyChallenge().getAttemptCount()).isEqualTo(1);
        assertThat(onlyChallenge().getLastAttemptAt()).isNotNull();
    }

    @Test
    void correctCodeIsRejectedAfterMaximumFailedAttempts() {
        phoneSmsService.sendCode(PHONE, SmsPurpose.LOGIN, IP, DEVICE);
        String correctCode = captureSingleMessage().code();
        String wrongCode = correctCode.equals("999999") ? "888888" : "999999";

        for (int i = 0; i < 5; i++) {
            assertThatThrownBy(() -> phoneSmsService.verifyCode(PHONE, SmsPurpose.LOGIN, wrongCode))
                    .isInstanceOf(SmsCodeInvalidException.class);
        }

        assertThat(onlyChallenge().getAttemptCount()).isEqualTo(5);
        assertThatThrownBy(() -> phoneSmsService.verifyCode(PHONE, SmsPurpose.LOGIN, correctCode))
                .isInstanceOf(SmsCodeInvalidException.class);
    }

    @Test
    void expiredAndPurposeMismatchedCodesReturnSameError() {
        SmsChallenge expired = challenge(PHONE, IP, DEVICE, LocalDateTime.now().minusMinutes(10));
        expired.setExpiresAt(LocalDateTime.now().minusMinutes(5));
        challengeRepository.saveAndFlush(expired);

        assertThatThrownBy(() -> phoneSmsService.verifyCode(PHONE, SmsPurpose.LOGIN, "123456"))
                .isInstanceOf(SmsCodeInvalidException.class)
                .hasMessage("验证码无效或已过期");

        challengeRepository.deleteAll();
        phoneSmsService.sendCode(PHONE, SmsPurpose.LOGIN, IP, DEVICE);
        String code = captureSingleMessage().code();
        assertThatThrownBy(() -> phoneSmsService.verifyCode(PHONE, SmsPurpose.REAUTH, code))
                .isInstanceOf(SmsCodeInvalidException.class)
                .hasMessage("验证码无效或已过期");
    }

    @Test
    void concurrentVerificationAllowsExactlyOneConsumer() throws Exception {
        phoneSmsService.sendCode(PHONE, SmsPurpose.LOGIN, IP, DEVICE);
        String code = captureSingleMessage().code();
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger successes = new AtomicInteger();
        AtomicInteger failures = new AtomicInteger();

        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            List<Future<?>> futures = List.of(
                    executor.submit(() -> verifyConcurrently(code, ready, start, successes, failures)),
                    executor.submit(() -> verifyConcurrently(code, ready, start, successes, failures)));
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            for (Future<?> future : futures) {
                future.get(10, TimeUnit.SECONDS);
            }
        } finally {
            executor.shutdownNow();
        }

        assertThat(successes.get()).isEqualTo(1);
        assertThat(failures.get()).isEqualTo(1);
        assertThat(onlyChallenge().getConsumedAt()).isNotNull();
    }

    private void verifyConcurrently(String code,
                                    CountDownLatch ready,
                                    CountDownLatch start,
                                    AtomicInteger successes,
                                    AtomicInteger failures) {
        ready.countDown();
        try {
            start.await(5, TimeUnit.SECONDS);
            phoneSmsService.verifyCode(PHONE, SmsPurpose.LOGIN, code);
            successes.incrementAndGet();
        } catch (SmsCodeInvalidException e) {
            failures.incrementAndGet();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }

    private SmsMessage captureSingleMessage() {
        org.mockito.ArgumentCaptor<SmsMessage> captor = org.mockito.ArgumentCaptor.forClass(SmsMessage.class);
        verify(smsSender, times(1)).send(captor.capture());
        return captor.getValue();
    }

    private SmsChallenge onlyChallenge() {
        assertThat(challengeRepository.findAll()).hasSize(1);
        return challengeRepository.findAll().get(0);
    }

    private void saveHistorical(String phone, String ip, String deviceId) {
        challengeRepository.saveAndFlush(challenge(phone, ip, deviceId, LocalDateTime.now().minusMinutes(2)));
    }

    private SmsChallenge challenge(String phone, String ip, String deviceId, LocalDateTime createdAt) {
        SmsChallenge challenge = new SmsChallenge();
        challenge.setPhoneHash(phoneIdentityCodec.lookupHash(phone));
        challenge.setPurpose(SmsPurpose.LOGIN);
        challenge.setCodeHash(codeHasher.hash(phone, SmsPurpose.LOGIN, "123456"));
        challenge.setExpiresAt(createdAt.plusMinutes(5));
        challenge.setAttemptCount(0);
        challenge.setMaxAttempts(5);
        challenge.setRequestIp(ip);
        challenge.setDeviceId(deviceId);
        challenge.setCreatedAt(createdAt);
        return challenge;
    }

    private void assertRateLimited(String phone, String ip, String deviceId) {
        assertThatThrownBy(() -> phoneSmsService.sendCode(phone, SmsPurpose.LOGIN, ip, deviceId))
                .isInstanceOf(BusinessException.class)
                .hasMessage("请求过于频繁，请稍后再试");
    }
}
