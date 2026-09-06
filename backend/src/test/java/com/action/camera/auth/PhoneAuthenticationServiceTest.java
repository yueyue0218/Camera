package com.action.camera.auth;

import com.action.camera.auth.domain.SmsChallenge;
import com.action.camera.auth.domain.SmsPurpose;
import com.action.camera.auth.domain.UserSession;
import com.action.camera.auth.repository.SmsChallengeRepository;
import com.action.camera.auth.repository.UserSessionRepository;
import com.action.camera.auth.service.PhoneAuthenticationResult;
import com.action.camera.auth.service.PhoneAuthenticationService;
import com.action.camera.auth.service.PhoneLoginRejectedException;
import com.action.camera.auth.service.PhoneSmsService;
import com.action.camera.auth.service.SmsCodeInvalidException;
import com.action.camera.auth.sms.SmsDeliveryReceipt;
import com.action.camera.auth.sms.SmsMessage;
import com.action.camera.auth.sms.SmsSender;
import com.action.camera.common.JwtUtil;
import com.action.camera.domain.User;
import com.action.camera.repository.UserRepository;
import com.action.camera.repository.UserRoleBindingRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:phone_authentication_service_test;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;NON_KEYWORDS=CURRENT_ROLE;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "camera.sms.code-pepper=phone-authentication-test-pepper-never-production",
        "camera.sms.phone-hourly-limit=20",
        "camera.sms.ip-hourly-limit=20",
        "camera.sms.device-hourly-limit=20",
        "camera.session.refresh-ttl=30d"
})
class PhoneAuthenticationServiceTest {

    private static final String PHONE = "+8613800138000";
    private static final String IP = "203.0.113.40";
    private static final String DEVICE_ID = "phone-auth-device";

    @Autowired
    private PhoneSmsService phoneSmsService;

    @Autowired
    private PhoneAuthenticationService authenticationService;

    @Autowired
    private SmsChallengeRepository challengeRepository;

    @Autowired
    private UserSessionRepository sessionRepository;

    @Autowired
    private UserRoleBindingRepository roleBindingRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtil jwtUtil;

    @MockBean
    private SmsSender smsSender;

    @BeforeEach
    void setUp() {
        sessionRepository.deleteAll();
        challengeRepository.deleteAll();
        roleBindingRepository.deleteAll();
        userRepository.deleteAll();
        reset(smsSender);
        when(smsSender.send(any(SmsMessage.class)))
                .thenReturn(new SmsDeliveryReceipt("test-provider-message-id"));
    }

    @AfterEach
    void cleanUp() {
        sessionRepository.deleteAll();
        challengeRepository.deleteAll();
        roleBindingRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void verifiedNewPhoneCreatesCustomerAndUsableSessionMaterialAtomically() throws Exception {
        String code = sendAndCaptureCode();

        PhoneAuthenticationResult result = authenticationService.verifyAndLogin(
                PHONE, SmsPurpose.LOGIN, code, DEVICE_ID, "Chrome on Windows");

        User user = userRepository.findByPhone(PHONE).orElseThrow();
        assertThat(user.getPhoneVerifiedAt()).isNotNull();
        assertThat(user.getLastLoginAt()).isNotNull();
        assertThat(user.getCurrentRole()).isEqualTo("CUSTOMER");
        assertThat(roleBindingRepository.existsByUserIdAndRole(user.getId(), "CUSTOMER")).isTrue();

        UserSession session = sessionRepository.findAll().get(0);
        assertThat(session.getUserId()).isEqualTo(user.getId());
        assertThat(session.getDeviceId()).isEqualTo(DEVICE_ID);
        assertThat(session.getDeviceName()).isEqualTo("Chrome on Windows");
        assertThat(session.getRefreshTokenHash()).isEqualTo(sha256(result.refreshToken()));
        assertThat(session.getRefreshTokenHash()).doesNotContain(result.refreshToken());
        assertThat(session.getExpiresAt()).isAfter(session.getCreatedAt().plusDays(29));
        assertThat(jwtUtil.parseUserId(result.response().getToken())).isEqualTo(user.getId());
        assertThat(jwtUtil.parseSessionId(result.response().getToken())).isEqualTo(session.getSessionId());
        assertThat(result.response().isAdminCapable()).isFalse();
    }

    @Test
    void verifiedExistingPhonePreservesProfileAndDoesNotDuplicateUser() {
        User existing = new User();
        existing.setPhone(PHONE);
        existing.setNickname("已有昵称");
        existing.setCurrentRole("PROVIDER");
        existing.setStatus("ACTIVE");
        existing = userRepository.saveAndFlush(existing);
        String code = sendAndCaptureCode();

        PhoneAuthenticationResult result = authenticationService.verifyAndLogin(
                PHONE, SmsPurpose.LOGIN, code, DEVICE_ID, null);

        assertThat(userRepository.count()).isEqualTo(1);
        User reloaded = userRepository.findById(existing.getId()).orElseThrow();
        assertThat(reloaded.getNickname()).isEqualTo("已有昵称");
        assertThat(reloaded.getCurrentRole()).isEqualTo("PROVIDER");
        assertThat(reloaded.getLastLoginAt()).isNotNull();
        assertThat(result.response().getRole()).isEqualTo("PROVIDER");
        assertThat(roleBindingRepository.existsByUserIdAndRole(existing.getId(), "CUSTOMER")).isTrue();
    }

    @Test
    void disabledUserConsumesValidCodeWithoutCreatingSession() {
        User disabled = new User();
        disabled.setPhone(PHONE);
        disabled.setNickname("停用用户");
        disabled.setStatus("DISABLED");
        userRepository.saveAndFlush(disabled);
        String code = sendAndCaptureCode();

        assertThatThrownBy(() -> authenticationService.verifyAndLogin(
                PHONE, SmsPurpose.LOGIN, code, DEVICE_ID, null))
                .isInstanceOf(PhoneLoginRejectedException.class)
                .hasMessage("暂时无法登录");

        assertThat(challengeRepository.findAll().get(0).getConsumedAt()).isNotNull();
        assertThat(sessionRepository.count()).isZero();
    }

    @Test
    void wrongCodeAttemptRemainsPersistedThroughAuthenticationTransaction() {
        String code = sendAndCaptureCode();
        String wrongCode = code.equals("999999") ? "888888" : "999999";

        assertThatThrownBy(() -> authenticationService.verifyAndLogin(
                PHONE, SmsPurpose.LOGIN, wrongCode, DEVICE_ID, null))
                .isInstanceOf(SmsCodeInvalidException.class)
                .hasMessage("验证码无效或已过期");

        SmsChallenge challenge = challengeRepository.findAll().get(0);
        assertThat(challenge.getAttemptCount()).isEqualTo(1);
        assertThat(userRepository.count()).isZero();
        assertThat(sessionRepository.count()).isZero();
    }

    private String sendAndCaptureCode() {
        phoneSmsService.sendCode(PHONE, SmsPurpose.LOGIN, IP, DEVICE_ID);
        var captor = org.mockito.ArgumentCaptor.forClass(SmsMessage.class);
        verify(smsSender).send(captor.capture());
        return captor.getValue().code();
    }

    private String sha256(String value) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8));
        return HexFormat.of().formatHex(digest);
    }
}
