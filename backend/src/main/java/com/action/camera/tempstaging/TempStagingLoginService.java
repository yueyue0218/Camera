package com.action.camera.tempstaging;

import com.action.camera.auth.service.AuthSessionService;
import com.action.camera.auth.service.SessionAuthenticationResult;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.security.UserRole;
import com.action.camera.domain.User;
import com.action.camera.repository.UserRepository;
import com.action.camera.repository.UserRoleBindingRepository;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile("temp-staging")
public class TempStagingLoginService {

    private final TempStagingStartupGate startupGate;
    private final TempStagingLoginRateLimiter rateLimiter;
    private final UserRepository userRepository;
    private final UserRoleBindingRepository roleBindingRepository;
    private final AuthSessionService sessionService;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public TempStagingLoginService(TempStagingStartupGate startupGate,
                                   TempStagingLoginRateLimiter rateLimiter,
                                   UserRepository userRepository,
                                   UserRoleBindingRepository roleBindingRepository,
                                   AuthSessionService sessionService) {
        this.startupGate = startupGate;
        this.rateLimiter = rateLimiter;
        this.userRepository = userRepository;
        this.roleBindingRepository = roleBindingRepository;
        this.sessionService = sessionService;
    }

    @Transactional
    public SessionAuthenticationResult login(TempStagingLoginRequest request, String ipAddress) {
        Long userId = request.userId();
        Long limitedAccountId = startupGate.allows(userId) ? userId : null;
        rateLimiter.check(limitedAccountId, ipAddress);
        User user = limitedAccountId == null ? null : userRepository.findById(userId).orElse(null);
        if (!isValid(user, request.password())) {
            rateLimiter.recordFailure(limitedAccountId, ipAddress);
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "临时测试账号或密码错误");
        }

        String role = user.getCurrentRole();
        SessionAuthenticationResult result =
                sessionService.issue(user, role, false, request.deviceId(), request.deviceName());
        rateLimiter.recordSuccess(userId);
        return result;
    }

    private boolean isValid(User user, String password) {
        if (user == null || !"ACTIVE".equals(user.getStatus())) {
            return false;
        }
        if (roleBindingRepository.existsByUserIdAndRole(user.getId(), UserRole.ADMIN.name())) {
            return false;
        }
        String role = user.getCurrentRole();
        if (!UserRole.CUSTOMER.name().equals(role) && !UserRole.PROVIDER.name().equals(role)) {
            return false;
        }
        if (!roleBindingRepository.existsByUserIdAndRole(user.getId(), role)) {
            return false;
        }
        String passwordHash = user.getPasswordHash();
        if (passwordHash == null || passwordHash.isBlank()) {
            return false;
        }
        try {
            return passwordEncoder.matches(password, passwordHash);
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
}
