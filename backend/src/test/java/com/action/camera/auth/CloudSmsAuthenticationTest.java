package com.action.camera.auth;

import com.action.camera.auth.domain.SmsDeliveryStatus;
import com.action.camera.auth.domain.SmsPurpose;
import com.action.camera.auth.repository.SmsChallengeRepository;
import com.action.camera.auth.repository.UserSessionRepository;
import com.action.camera.auth.service.PhoneAuthenticationService;
import com.action.camera.auth.service.PhoneSmsService;
import com.action.camera.auth.service.SmsCodeHasher;
import com.action.camera.auth.service.SmsCodeInvalidException;
import com.action.camera.auth.sms.*;
import com.action.camera.repository.UserRepository;
import com.action.camera.repository.UserRoleBindingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:cloud_sms_auth;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;NON_KEYWORDS=CURRENT_ROLE;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class CloudSmsAuthenticationTest {
    private static final String PHONE = "+8613800138000";
    @Autowired PhoneSmsService sms;
    @Autowired PhoneAuthenticationService authentication;
    @Autowired SmsChallengeRepository challenges;
    @Autowired UserSessionRepository sessions;
    @Autowired UserRoleBindingRepository roles;
    @Autowired UserRepository users;
    @Autowired SmsCodeHasher hasher;
    @MockBean(extraInterfaces = SmsCloudVerifier.class) SmsSender sender;
    private SmsCloudVerifier verifier;
    private String cloudCode;
    private String challengeId;

    @BeforeEach
    void setUp() {
        sessions.deleteAll();
        roles.deleteAll();
        users.deleteAll();
        challenges.deleteAll();
        reset(sender);
        verifier = (SmsCloudVerifier) sender;
        when(sender.send(any())).thenAnswer(invocation -> {
            SmsMessage message = invocation.getArgument(0);
            cloudCode = message.code();
            return new SmsDeliveryReceipt("mock-cloud-biz");
        });
        when(verifier.verifyCode(eq(PHONE), anyString())).thenAnswer(invocation ->
                invocation.getArgument(1).equals(cloudCode));
    }

    @Test
    void sentCodeMustMatchLocalChallengeEvenWhenCloudWouldAcceptAnotherCodeAndCannotReplay() {
        send();
        var challenge = challenges.findAll().get(0);
        assertThat(hasher.matches(challenge, cloudCode)).isTrue();
        String wrong = cloudCode.equals("123456") ? "654321" : "123456";
        when(verifier.verifyCode(PHONE, wrong)).thenReturn(true);
        assertThatThrownBy(() -> consume(wrong)).isInstanceOf(SmsCodeInvalidException.class);
        assertThat(users.count()).isZero();
        assertThat(sessions.count()).isZero();
        var result = authentication.verifyAndLogin(challengeId, "138 0013-8000", SmsPurpose.LOGIN,
                cloudCode, "cloud-device", "test");
        assertThat(result.response().isNewUser()).isTrue();
        assertThat(users.count()).isEqualTo(1);
        assertThat(sessions.count()).isEqualTo(1);
        assertThat(challenges.findById(challenge.getId()).orElseThrow().getConsumedAt()).isNotNull();
        assertThatThrownBy(() -> consume(cloudCode))
                .isInstanceOf(SmsCodeInvalidException.class);
        verify(verifier, never()).verifyCode(anyString(), anyString());
    }

    @Test
    void unavailableCloudVerifierCannotChangeLocalAttemptsOrBlockLocalConsumption() {
        send();
        when(verifier.verifyCode(anyString(), anyString()))
                .thenThrow(new SmsDeliveryException("malformed provider response"));
        var challenge = challenges.findAll().get(0);
        assertThat(challenge.getAttemptCount()).isZero();
        assertThat(challenge.getConsumedAt()).isNull();
        assertThat(consume(cloudCode)).isEqualTo(PHONE);
        var consumed = challenges.findById(challenge.getId()).orElseThrow();
        assertThat(consumed.getAttemptCount()).isZero();
        assertThat(consumed.getConsumedAt()).isNotNull();
        verify(verifier, never()).verifyCode(anyString(), anyString());
    }

    @Test
    void wrongLocalCodePersistsAttemptsAndNeverCallsCloudAtLimit() {
        send();
        String wrong = cloudCode.equals("123456") ? "654321" : "123456";
        for (int i = 0; i < 5; i++) {
            assertThatThrownBy(() -> consume(wrong))
                    .isInstanceOf(SmsCodeInvalidException.class);
        }
        assertThat(challenges.findAll().get(0).getAttemptCount()).isEqualTo(5);
        assertThatThrownBy(() -> consume(cloudCode))
                .isInstanceOf(SmsCodeInvalidException.class);
        verify(verifier, never()).verifyCode(anyString(), anyString());
    }

    @Test
    void expiredLocalChallengeDoesNotCallCloud() {
        send();
        var challenge = challenges.findAll().get(0);
        challenge.setExpiresAt(LocalDateTime.now().minusSeconds(1));
        challenges.saveAndFlush(challenge);
        assertThatThrownBy(() -> consume(cloudCode))
                .isInstanceOf(SmsCodeInvalidException.class);
        verify(verifier, never()).verifyCode(anyString(), anyString());
    }

    @Test
    void failedCloudSendPersistsFailedAndNeverVerifiesIt() {
        doThrow(new SmsDeliveryException("isp.SYSTEM_ERROR")).when(sender).send(any());
        assertThatThrownBy(this::send).hasMessage("短信暂时无法发送，请稍后重试");
        assertThat(challenges.findAll().get(0).getDeliveryStatus()).isEqualTo(SmsDeliveryStatus.FAILED);
        challengeId = challenges.findAll().get(0).getChallengeId();
        assertThatThrownBy(() -> consume("123456"))
                .isInstanceOf(SmsCodeInvalidException.class);
        verify(verifier, never()).verifyCode(anyString(), anyString());
    }

    private void send() {
        challengeId = sms.createChallenge("13800138000", SmsPurpose.LOGIN, "203.0.113.40", "cloud-device", null, null, "LOGIN").challengeId();
    }
    private String consume(String code) {
        return sms.consumeChallenge(challengeId, PHONE, SmsPurpose.LOGIN, code, null, null, "LOGIN");
    }
}
