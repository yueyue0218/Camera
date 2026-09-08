package com.action.camera.admin.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.repository.UserRoleBindingRepository;
import org.springframework.stereotype.Service;

@Service
public class AdminPermissionService {

    private static final String ADMIN = "ADMIN";

    private final UserRoleBindingRepository userRoleBindingRepository;

    public AdminPermissionService(UserRoleBindingRepository userRoleBindingRepository) {
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
        // This flag is populated by AuthInterceptor only after an ADMIN binding
        // lookup. Reusing it within the same request avoids duplicate queries.
        if (userId.equals(UserContext.getUserId()) && UserContext.isAdmin()) {
            return true;
        }
        return userRoleBindingRepository.existsByUserIdAndRole(userId, ADMIN);
    }
}
