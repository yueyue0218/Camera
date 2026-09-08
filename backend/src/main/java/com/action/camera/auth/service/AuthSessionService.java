package com.action.camera.auth.service;

import com.action.camera.auth.config.SessionProperties;
import com.action.camera.auth.domain.UserSession;
import com.action.camera.auth.dto.SessionResponse;
import com.action.camera.auth.repository.UserSessionRepository;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.JwtUtil;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.security.UserRole;
import com.action.camera.domain.User;
import com.action.camera.dto.LoginResponse;
import com.action.camera.repository.UserRepository;
import com.action.camera.repository.UserRoleBindingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;

@Service
public class AuthSessionService {

    private static final String ACTIVE_STATUS = "ACTIVE";
    private static final String ADMIN_ROLE = UserRole.ADMIN.name();

    private final UserSessionRepository sessionRepository;
    private final UserRepository userRepository;
    private final UserRoleBindingRepository roleBindingRepository;
    private final SessionProperties properties;
    private final JwtUtil jwtUtil;
    private final SecureRandom secureRandom = new SecureRandom();

    public AuthSessionService(UserSessionRepository sessionRepository,
                              UserRepository userRepository,
                              UserRoleBindingRepository roleBindingRepository,
                              SessionProperties properties,
                              JwtUtil jwtUtil) {
        this.sessionRepository = sessionRepository;
        this.userRepository = userRepository;
        this.roleBindingRepository = roleBindingRepository;
        this.properties = properties;
        this.jwtUtil = jwtUtil;
    }

    @Transactional
    public SessionAuthenticationResult issue(User user,
                                             String role,
                                             boolean adminCapable,
                                             String deviceId,
                                             String deviceName) {
        UserRole sessionRole = UserRole.parse(role, null);
        boolean boundAdmin = hasAdminPermission(user);
        if (!roleBindingRepository.existsByUserIdAndRole(user.getId(), sessionRole.name())
                || adminCapable != boundAdmin) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
        LocalDateTime now = LocalDateTime.now();
        String sessionId = randomToken(32);
        String refreshToken = refreshToken(sessionId);

        UserSession session = new UserSession();
        session.setSessionId(sessionId);
        session.setUserId(user.getId());
        session.setRefreshTokenHash(hash(refreshToken));
        session.setDeviceId(trimToNull(deviceId));
        session.setDeviceName(trimToNull(deviceName));
        session.setCreatedAt(now);
        session.setExpiresAt(now.plus(properties.getRefreshTtl()));
        sessionRepository.saveAndFlush(session);

        return result(user, sessionRole.name(), boundAdmin, session, refreshToken);
    }

    @Transactional(noRollbackFor = BusinessException.class)
    public SessionAuthenticationResult refresh(String rawRefreshToken) {
        String sessionId = extractSessionId(rawRefreshToken);
        UserSession session = sessionRepository.findBySessionIdForUpdate(sessionId)
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
        LocalDateTime now = LocalDateTime.now();

        if (session.getRevokedAt() != null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        if (!session.getExpiresAt().isAfter(now)) {
            revoke(session, now, "EXPIRED");
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        if (!constantTimeEquals(session.getRefreshTokenHash(), hash(rawRefreshToken))) {
            revoke(session, now, "REFRESH_TOKEN_REPLAY");
            throw new RefreshTokenReplayException();
        }

        User user = userRepository.findById(session.getUserId())
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
        if (!ACTIVE_STATUS.equals(user.getStatus())) {
            revoke(session, now, "USER_DISABLED");
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }

        boolean adminCapable = hasAdminPermission(user);
        String role = resolveBoundRole(user, adminCapable);
        String rotatedRefreshToken = refreshToken(sessionId);
        session.setRefreshTokenHash(hash(rotatedRefreshToken));
        session.setLastSeenAt(now);
        sessionRepository.saveAndFlush(session);
        return result(user, role, adminCapable, session, rotatedRefreshToken);
    }

    @Transactional
    public void logout(Long userId, String sessionId) {
        UserSession session = sessionRepository.findBySessionIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
        if (session.getRevokedAt() == null) {
            revoke(session, LocalDateTime.now(), "LOGOUT");
        }
    }

    @Transactional(readOnly = true)
    public SessionResponse current(Long userId, String sessionId) {
        UserSession session = sessionRepository.findBySessionIdAndUserId(sessionId, userId)
                .filter(value -> value.getRevokedAt() == null && value.getExpiresAt().isAfter(LocalDateTime.now()))
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
        User user = userRepository.findById(userId)
                .filter(value -> ACTIVE_STATUS.equals(value.getStatus()))
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
        boolean adminCapable = hasAdminPermission(user);
        String role = resolveBoundRole(user, adminCapable);
        return new SessionResponse(
                user.getId(), user.getNickname(), role, adminCapable,
                session.getSessionId(), session.getDeviceId(), session.getDeviceName(),
                session.getCreatedAt(), session.getExpiresAt());
    }

    private SessionAuthenticationResult result(User user,
                                               String role,
                                               boolean adminCapable,
                                               UserSession session,
                                               String refreshToken) {
        LoginResponse response = new LoginResponse(
                jwtUtil.generateToken(user.getId(), session.getSessionId()),
                user.getId(), user.getNickname(), role, adminCapable);
        return new SessionAuthenticationResult(
                response, refreshToken, properties.getRefreshCookieName(), properties.getRefreshTtl());
    }

    private boolean hasAdminPermission(User user) {
        return roleBindingRepository.existsByUserIdAndRole(user.getId(), ADMIN_ROLE);
    }

    private String resolveBoundRole(User user, boolean adminCapable) {
        if (adminCapable) {
            return ADMIN_ROLE;
        }
        UserRole currentRole = UserRole.parse(user.getCurrentRole(), UserRole.CUSTOMER);
        if (roleBindingRepository.existsByUserIdAndRole(user.getId(), currentRole.name())) {
            return currentRole.name();
        }
        if (roleBindingRepository.existsByUserIdAndRole(user.getId(), UserRole.CUSTOMER.name())) {
            return UserRole.CUSTOMER.name();
        }
        throw new BusinessException(ErrorCode.FORBIDDEN);
    }

    private void revoke(UserSession session, LocalDateTime now, String reason) {
        session.setRevokedAt(now);
        session.setRevokeReason(reason);
        sessionRepository.saveAndFlush(session);
    }

    private String refreshToken(String sessionId) {
        return sessionId + "." + randomToken(48);
    }

    private String extractSessionId(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        int separator = refreshToken.indexOf('.');
        if (separator < 20 || separator > 64 || separator != refreshToken.lastIndexOf('.')) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        String sessionId = refreshToken.substring(0, separator);
        if (!sessionId.matches("[A-Za-z0-9_-]+")) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return sessionId;
    }

    private String randomToken(int byteCount) {
        byte[] bytes = new byte[byteCount];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    private boolean constantTimeEquals(String expected, String actual) {
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.US_ASCII),
                actual.getBytes(StandardCharsets.US_ASCII));
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.length() <= 128 ? trimmed : trimmed.substring(0, 128);
    }
}
