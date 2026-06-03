package com.action.camera.common.security;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Temporary P4 current-user provider.
 *
 * A module will replace this with JWT/NJU identity authentication later. For
 * now, local frontend and API tests pass X-User-Id / X-User-Role headers.
 */
@Component
public class MockCurrentUserProvider {

    private static final long DEFAULT_CUSTOMER_ID = 1001L;

    public CurrentUser getCurrentUser(HttpServletRequest request) {
        return getCurrentUserIfPresent(request)
                .orElseGet(() -> new CurrentUser(DEFAULT_CUSTOMER_ID, UserRole.CUSTOMER));
    }

    public Optional<CurrentUser> getCurrentUserIfPresent(HttpServletRequest request) {
        Long contextUserId = UserContext.getUserId();
        if (contextUserId != null) {
            UserRole contextRole = UserContext.getCurrentRole();
            UserRole resolvedRole = contextRole == null
                    ? UserRole.parse(request.getHeader("X-User-Role"), UserRole.CUSTOMER)
                    : contextRole;
            return Optional.of(new CurrentUser(contextUserId, resolvedRole));
        }
        if (request.getHeader("X-User-Id") == null || request.getHeader("X-User-Id").isBlank()) {
            return Optional.empty();
        }
        Long userId = readUserId(request.getHeader("X-User-Id"));
        UserRole role = UserRole.parse(request.getHeader("X-User-Role"), UserRole.CUSTOMER);
        return Optional.of(new CurrentUser(userId, role));
    }

    private Long readUserId(String value) {
        if (value == null || value.isBlank()) {
            return DEFAULT_CUSTOMER_ID;
        }
        try {
            long parsed = Long.parseLong(value.trim());
            if (parsed <= 0) {
                throw new NumberFormatException("user id must be positive");
            }
            return parsed;
        } catch (NumberFormatException e) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "X-User-Id 必须是正整数");
        }
    }
}
