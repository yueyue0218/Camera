package com.action.camera.admin.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.domain.User;
import com.action.camera.repository.UserRepository;
import org.springframework.stereotype.Service;

@Service
public class AdminPermissionService {

    private static final String ADMIN = "ADMIN";

    private final UserRepository userRepository;

    public AdminPermissionService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public Long requireAdmin() {
        Long userId = UserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        boolean admin = userRepository.findById(userId)
                .map(User::getCurrentRole)
                .map(ADMIN::equals)
                .orElse(false);
        if (!admin) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Admin permission required");
        }
        return userId;
    }
}
