package com.action.camera.auth;

import com.action.camera.auth.domain.SmsChallenge;
import com.action.camera.auth.domain.SmsPurpose;
import com.action.camera.auth.domain.UserSession;
import com.action.camera.auth.repository.SmsChallengeRepository;
import com.action.camera.auth.repository.UserSessionRepository;
import com.action.camera.domain.User;
import com.action.camera.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = "spring.http.client.factory=simple")
@ActiveProfiles("smoke")
@Transactional
class PhoneAuthPersistenceTest {

    @Autowired
    private SmsChallengeRepository smsChallengeRepository;

    @Autowired
    private UserSessionRepository userSessionRepository;

    @Autowired
    private UserRepository userRepository;

    @Test
    void challengeCanBeLockedAndQueriedForRateLimits() {
        LocalDateTime now = LocalDateTime.of(2026, 9, 5, 18, 0);
        SmsChallenge challenge = new SmsChallenge();
        challenge.setPhone("+8613800138000");
        challenge.setPurpose(SmsPurpose.LOGIN);
        challenge.setCodeHash("$2a$10$01234567890123456789012345678901234567890123456789012");
        challenge.setExpiresAt(now.plusMinutes(5));
        challenge.setRequestIp("203.0.113.10");
        challenge.setDeviceId("test-device");
        challenge.setCreatedAt(now);
        smsChallengeRepository.saveAndFlush(challenge);

        assertThat(smsChallengeRepository.findFirstByPhoneAndPurposeOrderByCreatedAtDesc(
                challenge.getPhone(), SmsPurpose.LOGIN)).contains(challenge);
        assertThat(smsChallengeRepository.countByPhoneAndCreatedAtAfter(
                challenge.getPhone(), now.minusSeconds(1))).isOne();
        assertThat(smsChallengeRepository.countByRequestIpAndCreatedAtAfter(
                challenge.getRequestIp(), now.minusSeconds(1))).isOne();
        assertThat(smsChallengeRepository.countByDeviceIdAndCreatedAtAfter(
                challenge.getDeviceId(), now.minusSeconds(1))).isOne();
        assertThat(challenge.getMaxAttempts()).isEqualTo(5);
    }

    @Test
    void activeSessionCanBeValidatedAndLockedByRefreshHash() {
        LocalDateTime now = LocalDateTime.of(2026, 9, 5, 18, 0);
        UserSession session = new UserSession();
        session.setSessionId("session-0123456789abcdef");
        session.setUserId(1001L);
        session.setRefreshTokenHash("a".repeat(64));
        session.setDeviceId("test-device");
        session.setDeviceName("JUnit browser");
        session.setCreatedAt(now);
        session.setExpiresAt(now.plusDays(30));
        userSessionRepository.saveAndFlush(session);

        assertThat(userSessionRepository.existsBySessionIdAndUserIdAndRevokedAtIsNullAndExpiresAtAfter(
                session.getSessionId(), session.getUserId(), now)).isTrue();
        assertThat(userSessionRepository.findBySessionIdAndUserId(
                session.getSessionId(), session.getUserId())).contains(session);
        assertThat(userSessionRepository.findByRefreshTokenHash(session.getRefreshTokenHash())).contains(session);
        assertThat(userSessionRepository
                .findAllByUserIdAndRevokedAtIsNullAndExpiresAtAfterOrderByCreatedAtDesc(1001L, now))
                .contains(session);
    }

    @Test
    void normalizedPhoneIsUniqueAndQueryable() {
        User first = user("+8613900139000", "Phone User One");
        userRepository.saveAndFlush(first);

        assertThat(userRepository.existsByPhone(first.getPhone())).isTrue();
        assertThat(userRepository.findByPhone(first.getPhone())).contains(first);
        assertThat(userRepository.findByPhoneForUpdate(first.getPhone())).contains(first);

        User duplicate = user(first.getPhone(), "Phone User Two");
        assertThatThrownBy(() -> userRepository.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private User user(String phone, String nickname) {
        User user = new User();
        user.setPhone(phone);
        user.setPhoneVerifiedAt(LocalDateTime.of(2026, 9, 5, 18, 0));
        user.setNickname(nickname);
        return user;
    }
}
