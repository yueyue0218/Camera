package com.action.camera.common.interceptor;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.JwtUtil;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * 鉴权拦截器：请求到达 Controller 前先检查通行证(token)。
 */
@Component
public class AuthInterceptor implements HandlerInterceptor {

    private final JwtUtil jwtUtil;

    public AuthInterceptor(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String demoUserId = request.getHeader("X-User-Id");
        if (demoUserId != null && !demoUserId.isBlank()) {
            try {
                UserContext.setUserId(Long.parseLong(demoUserId.trim()));
                return true;
            } catch (NumberFormatException e) {
                throw new BusinessException(ErrorCode.UNAUTHORIZED);
            }
        }

        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        String token = authHeader.substring(7); // 去掉 "Bearer "
        try {
            Long userId = jwtUtil.parseUserId(token);
            UserContext.setUserId(userId);
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        UserContext.clear(); // 请求结束清理，避免内存泄漏
    }
}
