package com.action.camera.common.interceptor;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.JwtUtil;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.security.UserRole;
import com.action.camera.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Optional;

@Component
public class AuthInterceptor implements HandlerInterceptor {

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;

    public AuthInterceptor(JwtUtil jwtUtil, UserRepository userRepository) {
        this.jwtUtil = jwtUtil;
        this.userRepository = userRepository;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        if (isPublicB1B2Get(request)) {
            return true;
        }

        boolean protectedB1B2Write = isProtectedB1B2Write(request);
        String demoUserId = request.getHeader("X-User-Id");
        if (demoUserId != null && !demoUserId.isBlank()) {
            try {
                Long userId = parseUserId(demoUserId);
                UserContext.setUserId(userId);
                UserRole role = resolveDemoRole(request, userId, protectedB1B2Write);
                enforceB1B2WriteRole(request, role);
                return true;
            } catch (NumberFormatException e) {
                throw new BusinessException(ErrorCode.UNAUTHORIZED);
            }
        }

        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        String token = authHeader.substring(7);
        try {
            Long userId = jwtUtil.parseUserId(token);
            UserContext.setUserId(userId);
            UserRole role = loadAndSetRole(userId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
            enforceB1B2WriteRole(request, role);
        } catch (Exception e) {
            if (e instanceof BusinessException businessException) {
                throw businessException;
            }
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return true;
    }

    private Long parseUserId(String value) {
        long userId = Long.parseLong(value.trim());
        if (userId <= 0) {
            throw new NumberFormatException("user id must be positive");
        }
        return userId;
    }

    private UserRole resolveDemoRole(HttpServletRequest request, Long userId, boolean requireExplicitRole) {
        String demoRole = request.getHeader("X-User-Role");
        if (demoRole != null && !demoRole.isBlank()) {
            UserRole role = UserRole.parse(demoRole, null);
            UserContext.setCurrentRole(role);
            return role;
        }
        if (requireExplicitRole) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "X-User-Role is required for this operation");
        }
        return loadAndSetRole(userId).orElse(null);
    }

    private boolean isPublicB1B2Get(HttpServletRequest request) {
        if (!"GET".equalsIgnoreCase(request.getMethod())) {
            return false;
        }
        String uri = request.getRequestURI();
        return uri.equals("/service-packages")
                || uri.equals("/services")
                || uri.equals("/demands")
                || uri.matches("^/(service-packages|services|demands)/\\d+$");
    }

    private boolean isProtectedB1B2Write(HttpServletRequest request) {
        if ("GET".equalsIgnoreCase(request.getMethod())) {
            return false;
        }
        String uri = request.getRequestURI();
        return uri.equals("/demands")
                || uri.startsWith("/demands/")
                || uri.equals("/services")
                || uri.startsWith("/services/")
                || uri.equals("/service-packages")
                || uri.startsWith("/service-packages/");
    }

    private void enforceB1B2WriteRole(HttpServletRequest request, UserRole role) {
        if (!isProtectedB1B2Write(request)) {
            return;
        }
        if (role == null) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Current user role is required");
        }
        UserRole requiredRole = requiredB1B2Role(request);
        if (requiredRole != null && role != requiredRole && role != UserRole.ADMIN) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
    }

    private UserRole requiredB1B2Role(HttpServletRequest request) {
        String method = request.getMethod().toUpperCase();
        String uri = request.getRequestURI();
        if (uri.equals("/demands") && "POST".equals(method)) {
            return UserRole.CUSTOMER;
        }
        if (uri.matches("^/demands/\\d+$") && ("PUT".equals(method) || "PATCH".equals(method))) {
            return UserRole.CUSTOMER;
        }
        if (uri.matches("^/demands/\\d+$") && "DELETE".equals(method)) {
            return null;
        }
        if (uri.matches("^/demands/\\d+/responses$") && "POST".equals(method)) {
            return UserRole.PROVIDER;
        }
        if (uri.matches("^/demands/\\d+/responses/\\d+/accept$") && "POST".equals(method)) {
            return UserRole.CUSTOMER;
        }
        if ((uri.equals("/services") || uri.equals("/service-packages")) && "POST".equals(method)) {
            return UserRole.PROVIDER;
        }
        if (uri.matches("^/(services|service-packages)/\\d+$") && "PUT".equals(method)) {
            return UserRole.PROVIDER;
        }
        if (uri.matches("^/(services|service-packages)/\\d+/offline$") && "PATCH".equals(method)) {
            return UserRole.PROVIDER;
        }
        if (uri.matches("^/(services|service-packages)/\\d+/(reserve|start-chat|interest)$")
                && "POST".equals(method)) {
            return UserRole.CUSTOMER;
        }
        if (uri.matches("^/(services|service-packages)/\\d+/interest$") && "DELETE".equals(method)) {
            return UserRole.CUSTOMER;
        }
        return null;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        UserContext.clear();
    }

    private Optional<UserRole> loadAndSetRole(Long userId) {
        return userRepository.findById(userId)
                .map(user -> UserRole.parse(user.getCurrentRole(), UserRole.CUSTOMER))
                .map(role -> {
                    UserContext.setCurrentRole(role);
                    return role;
                });
    }
}
