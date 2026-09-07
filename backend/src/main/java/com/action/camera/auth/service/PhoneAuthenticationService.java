package com.action.camera.auth.service;

import com.action.camera.auth.domain.SmsPurpose;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.security.UserRole;
import com.action.camera.domain.User;
import com.action.camera.domain.UserRoleBinding;
import com.action.camera.repository.UserRepository;
import com.action.camera.repository.UserRoleBindingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class PhoneAuthenticationService {

    private static final String ACTIVE_STATUS = "ACTIVE";
    private static final String DEFAULT_NICKNAME = "新用户";

    private final PhoneSmsService phoneSmsService;
    private final UserRepository userRepository;
    private final UserRoleBindingRepository roleBindingRepository;
    private final AuthSessionService sessionService;

    public PhoneAuthenticationService(PhoneSmsService phoneSmsService,
                                      UserRepository userRepository,
                                      UserRoleBindingRepository roleBindingRepository,
                                      AuthSessionService sessionService) {
        this.phoneSmsService = phoneSmsService;
        this.userRepository = userRepository;
        this.roleBindingRepository = roleBindingRepository;
        this.sessionService = sessionService;
    }

    @Transactional(noRollbackFor = {SmsCodeInvalidException.class, PhoneLoginRejectedException.class})
    public SessionAuthenticationResult verifyAndLogin(String rawPhone,
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

        boolean newUser = user == null;
        if (newUser) {
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

        String currentRole = UserRole.parse(user.getCurrentRole(), UserRole.CUSTOMER).name();
        SessionAuthenticationResult result = sessionService.issue(
                user, currentRole, false, normalizedDeviceId, normalizedDeviceName);
        result.response().setNewUser(newUser);
        return result;
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
