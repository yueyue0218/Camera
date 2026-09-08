package com.action.camera.support;

import com.action.camera.auth.service.AuthSessionService;
import com.action.camera.common.security.UserRole;
import com.action.camera.domain.User;
import com.action.camera.domain.UserRoleBinding;
import com.action.camera.repository.UserRepository;
import com.action.camera.repository.UserRoleBindingRepository;
import org.springframework.stereotype.Component;

@Component
public class TestAuthTokens {

    private final UserRepository userRepository;
    private final UserRoleBindingRepository roleBindingRepository;
    private final AuthSessionService sessionService;

    public TestAuthTokens(UserRepository userRepository,
                          UserRoleBindingRepository roleBindingRepository,
                          AuthSessionService sessionService) {
        this.userRepository = userRepository;
        this.roleBindingRepository = roleBindingRepository;
        this.sessionService = sessionService;
    }

    public String generateToken(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Test user does not exist: " + userId));
        UserRole role = UserRole.parse(user.getCurrentRole(), UserRole.CUSTOMER);
        ensureBinding(userId, role);
        boolean admin = roleBindingRepository.existsByUserIdAndRole(userId, UserRole.ADMIN.name());
        return sessionService.issue(
                        user,
                        role.name(),
                        admin,
                        "integration-test",
                        "JUnit")
                .response()
                .getToken();
    }

    private void ensureBinding(Long userId, UserRole role) {
        if (roleBindingRepository.existsByUserIdAndRole(userId, role.name())) {
            return;
        }
        UserRoleBinding binding = new UserRoleBinding();
        binding.setUserId(userId);
        binding.setRole(role.name());
        roleBindingRepository.saveAndFlush(binding);
    }
}
