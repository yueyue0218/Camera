package com.action.camera.auth.service;

import com.action.camera.auth.config.SessionProperties;
import com.action.camera.auth.domain.SmsPurpose;
import com.action.camera.auth.domain.UserSession;
import com.action.camera.auth.repository.UserSessionRepository;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.JwtUtil;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.security.UserRole;
import com.action.camera.domain.User;
import com.action.camera.domain.UserRoleBinding;
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
public class PhoneAuthenticationService {

    private static final String ACTIVE_STATUS = "ACTIVE";
    private static final String DEFAULT_NICKNAME = "新用户";

    private final PhoneSmsService phoneSmsService;
    private final UserRepository userRepository;
    private final UserRoleBindingRepository roleBindingRepository;
    private final UserSessionRepository sessionRepository;
    private final SessionProperties sessionProperties;
    private final JwtUtil jwtUtil;
    private final SecureRandom secureRandom = new SecureRandom();

    public PhoneAuthenticationService(PhoneSmsService phoneSmsService,
                                      UserRepository userRepository,
                                      UserRoleBindingRepository roleBindingRepository,
                                      UserSessionRepository sessionRepository,
                                      SessionProperties sessionProperties,
                                      JwtUtil jwtUtil) {
        this.phoneSmsService = phoneSmsService;
        this.userRepository = userRepository;
        this.roleBindingRepository = roleBindingRepository;
        this.sessionRepository = sessionRepository;
        this.sessionProperties = sessionProperties;
        this.jwtUtil = jwtUtil;
    }

    @Transactional(noRollbackFor = {SmsCodeInvalidException.class, PhoneLoginRejectedException.class})
    public PhoneAuthenticationResult verifyAndLogin(String rawPhone,
                                                    SmsPurpose purpose,
                                                    String code,
                                                    String deviceId,
                                                    String deviceName) {
        if (purpose != SmsPurpose.LOGIN) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "当前只支持 LOGIN");
        }
        String normalizedDeviceId = requireDeviceId(deviceId);
        String normalizedDeviceName = normalizeDeviceName(deviceName);
        String phone = phoneSmsService.verifyCode(rawPhone, purpose, code);
        LocalDateTime now = LocalDateTime.now();

        User user = userRepository.findByPhoneForUpdate(phone).orElse(null);
        if (user != null && (!ACTIVE_STATUS.equals(user.getStatus()) || isAdministrator(user))) {
            throw new PhoneLoginRejectedException();
        }

        if (user == null) {
            user = new User();
            user.setPhone(phone);
            user.setNickname(DEFAULT_NICKNAME);
            user.setCurrentRole(UserRole.CUSTOMER.name());
            user.setStatus(ACTIVE_STATUS);
        }
        user.setPhoneVerifiedAt(now);
        user.setLastLoginAt(now);
        user = userRepository.saveAndFlush(user);

        ensureCustomerRole(user.getId(), now);

        String sessionId = randomToken(32);
        String refreshToken = randomToken(48);
        UserSession session = new UserSession();
        session.setSessionId(sessionId);
        session.setUserId(user.getId());
        session.setRefreshTokenHash(sha256(refreshToken));
        session.setDeviceId(normalizedDeviceId);
        session.setDeviceName(normalizedDeviceName);
        session.setCreatedAt(now);
        session.setExpiresAt(now.plus(sessionProperties.getRefreshTtl()));
        sessionRepository.saveAndFlush(session);

        String currentRole = UserRole.parse(user.getCurrentRole(), UserRole.CUSTOMER).name();
        LoginResponse response = new LoginResponse(
                jwtUtil.generateToken(user.getId(), sessionId),
                user.getId(),
                user.getNickname(),
                currentRole,
                false
        );
        return new PhoneAuthenticationResult(
                response,
                refreshToken,
                sessionProperties.getRefreshCookieName(),
                sessionProperties.getRefreshTtl()
        );
    }

    private boolean isAdministrator(User user) {
        return UserRole.ADMIN.name().equals(user.getCurrentRole())
                || roleBindingRepository.existsByUserIdAndRole(user.getId(), UserRole.ADMIN.name());
    }

    private void ensureCustomerRole(Long userId, LocalDateTime grantedAt) {
        if (roleBindingRepository.existsByUserIdAndRole(userId, UserRole.CUSTOMER.name())) {
            return;
        }
        UserRoleBinding binding = new UserRoleBinding();
        binding.setUserId(userId);
        binding.setRole(UserRole.CUSTOMER.name());
        binding.setGrantedAt(grantedAt);
        roleBindingRepository.save(binding);
    }

    private String randomToken(int byteCount) {
        byte[] bytes = new byte[byteCount];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    private String requireDeviceId(String value) {
        if (value == null || value.isBlank() || value.length() > 128) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "设备标识无效");
        }
        return value.trim();
    }

    private String normalizeDeviceName(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        if (value.length() > 128) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "设备名称过长");
        }
        return value.trim();
    }
}
