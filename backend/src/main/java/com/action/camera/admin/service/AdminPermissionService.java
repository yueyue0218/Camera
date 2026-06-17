package com.action.camera.admin.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.domain.User;
import com.action.camera.repository.UserRepository;
import com.action.camera.repository.UserRoleBindingRepository;
import org.springframework.stereotype.Service;

@Service
public class AdminPermissionService {

    private static final String ADMIN = "ADMIN";

    private final UserRepository userRepository;
    private final UserRoleBindingRepository userRoleBindingRepository;

    public AdminPermissionService(UserRepository userRepository,
                                  UserRoleBindingRepository userRoleBindingRepository) {
        this.userRepository = userRepository;
        this.userRoleBindingRepository = userRoleBindingRepository;
    }

    public Long requireAdmin() {
        Long userId = UserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        if (!hasAdminPermission(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Admin permission required");
        }
        return userId;
    }

    public boolean hasAdminPermission(Long userId) {
        if (userId == null) {
            return false;
        }
        if (userId.equals(UserContext.getUserId()) && UserContext.isAdmin()) {
            return true;
        }
        return userRepository.findById(userId)
                .map(User::getCurrentRole)
                .map(currentRole -> ADMIN.equals(currentRole)
                        || userRoleBindingRepository.existsByUserIdAndRole(userId, ADMIN))
                .orElse(false);
    }
}
