package com.action.camera.common.security;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Resolves the authenticated user populated by the JWT interceptor.
 *
 * The request parameter remains for controller API compatibility, but request
 * headers are deliberately ignored: identity and role only come from the
 * server-validated UserContext.
 */
@Component
public class CurrentUserProvider {

    public CurrentUser getCurrentUser(HttpServletRequest request) {
        return getCurrentUserIfPresent(request)
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
    }

    public Optional<CurrentUser> getCurrentUserIfPresent(HttpServletRequest request) {
        Long contextUserId = UserContext.getUserId();
        if (contextUserId != null) {
            UserRole contextRole = UserContext.getCurrentRole();
            UserRole resolvedRole = contextRole == null ? UserRole.CUSTOMER : contextRole;
            return Optional.of(new CurrentUser(contextUserId, resolvedRole, UserContext.isAdmin()));
        }
        return Optional.empty();
    }
}
