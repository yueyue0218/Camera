package com.action.camera.auth;

import com.action.camera.auth.domain.UserSession;
import com.action.camera.auth.repository.UserSessionRepository;
import com.action.camera.auth.service.AuthSessionService;
import com.action.camera.auth.service.RefreshTokenReplayException;
import com.action.camera.auth.service.SessionAuthenticationResult;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.JwtUtil;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.domain.User;
import com.action.camera.domain.UserRoleBinding;
import com.action.camera.repository.UserRepository;
import com.action.camera.repository.UserRoleBindingRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:auth_session_service_test;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;NON_KEYWORDS=CURRENT_ROLE;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "jwt.secret=auth-session-service-test-secret-with-at-least-32-bytes",
        "jwt.access-ttl=15m",
        "camera.session.refresh-ttl=30d"
})
class AuthSessionServiceTest {

    @Autowired
    private AuthSessionService service;

    @Autowired
    private UserSessionRepository sessionRepository;

    @Autowired
    private UserRoleBindingRepository roleBindingRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtil jwtUtil;

    @BeforeEach
    void setUp() {
        sessionRepository.deleteAll();
        roleBindingRepository.deleteAll();
        userRepository.deleteAll();
    }

    @AfterEach
    void cleanUp() {
        sessionRepository.deleteAll();
        roleBindingRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void refreshRotatesTokenAndIssuesAccessTokenForSameSession() {
        User user = user("CUSTOMER", "ACTIVE");
        SessionAuthenticationResult issued = service.issue(user, "CUSTOMER", false, "device-1", "Chrome");
        String sessionId = jwtUtil.parseSessionId(issued.response().getToken());

        SessionAuthenticationResult refreshed = service.refresh(issued.refreshToken());

        assertThat(refreshed.refreshToken()).isNotEqualTo(issued.refreshToken());
        assertThat(jwtUtil.parseSessionId(refreshed.response().getToken())).isEqualTo(sessionId);
        assertThat(jwtUtil.parseUserId(refreshed.response().getToken())).isEqualTo(user.getId());
        UserSession session = sessionRepository.findBySessionId(sessionId).orElseThrow();
        assertThat(session.getLastSeenAt()).isNotNull();
        assertThat(session.getRevokedAt()).isNull();
    }

    @Test
    void replayOfRotatedTokenRevokesWholeSession() {
        User user = user("CUSTOMER", "ACTIVE");
        SessionAuthenticationResult issued = service.issue(user, "CUSTOMER", false, "device-1", null);
        SessionAuthenticationResult refreshed = service.refresh(issued.refreshToken());
        String sessionId = jwtUtil.parseSessionId(refreshed.response().getToken());

        assertThatThrownBy(() -> service.refresh(issued.refreshToken()))
                .isInstanceOf(RefreshTokenReplayException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.UNAUTHORIZED);

        UserSession revoked = sessionRepository.findBySessionId(sessionId).orElseThrow();
        assertThat(revoked.getRevokedAt()).isNotNull();
        assertThat(revoked.getRevokeReason()).isEqualTo("REFRESH_TOKEN_REPLAY");
        assertThatThrownBy(() -> service.refresh(refreshed.refreshToken()))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.UNAUTHORIZED);
    }

    @Test
    void logoutRevokesSessionImmediately() {
        User user = user("CUSTOMER", "ACTIVE");
        SessionAuthenticationResult issued = service.issue(user, "CUSTOMER", false, "device-1", null);
        String sessionId = jwtUtil.parseSessionId(issued.response().getToken());

        service.logout(user.getId(), sessionId);

        UserSession revoked = sessionRepository.findBySessionId(sessionId).orElseThrow();
        assertThat(revoked.getRevokedAt()).isNotNull();
        assertThat(revoked.getRevokeReason()).isEqualTo("LOGOUT");
        assertThatThrownBy(() -> service.refresh(issued.refreshToken()))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void disabledUserRefreshRevokesSession() {
        User user = user("CUSTOMER", "ACTIVE");
        SessionAuthenticationResult issued = service.issue(user, "CUSTOMER", false, "device-1", null);
        String sessionId = jwtUtil.parseSessionId(issued.response().getToken());
        user.setStatus("DISABLED");
        userRepository.saveAndFlush(user);

        assertThatThrownBy(() -> service.refresh(issued.refreshToken()))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.UNAUTHORIZED);

        UserSession revoked = sessionRepository.findBySessionId(sessionId).orElseThrow();
        assertThat(revoked.getRevokeReason()).isEqualTo("USER_DISABLED");
    }

    @Test
    void adminBindingIsRestoredOnRefreshAndSessionSummary() {
        User user = user("PROVIDER", "ACTIVE");
        UserRoleBinding binding = new UserRoleBinding();
        binding.setUserId(user.getId());
        binding.setRole("ADMIN");
        roleBindingRepository.saveAndFlush(binding);
        SessionAuthenticationResult issued = service.issue(user, "ADMIN", true, "admin-web", "Browser");
        String sessionId = jwtUtil.parseSessionId(issued.response().getToken());

        SessionAuthenticationResult refreshed = service.refresh(issued.refreshToken());
        var summary = service.current(user.getId(), sessionId);

        assertThat(refreshed.response().getRole()).isEqualTo("ADMIN");
        assertThat(refreshed.response().isAdminCapable()).isTrue();
        assertThat(summary.role()).isEqualTo("ADMIN");
        assertThat(summary.adminCapable()).isTrue();
        assertThat(summary.deviceName()).isEqualTo("Browser");
    }

    @Test
    void malformedRefreshTokenIsUnauthorized() {
        assertThatThrownBy(() -> service.refresh("not-a-session-token"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.UNAUTHORIZED);
    }

    private User user(String role, String status) {
        User user = new User();
        user.setNickname("Session User");
        user.setCurrentRole(role);
        user.setStatus(status);
        return userRepository.saveAndFlush(user);
    }
}
