package com.action.camera.common;

/**
 * 保存当前请求的登录用户 id。
 * 拦截器验证 token 后把 userId 存进来，业务代码用 UserContext.getUserId() 取。
 */
public class UserContext {

    private static final ThreadLocal<Long> CURRENT_USER = new ThreadLocal<>();

    public static void setUserId(Long userId) {
        CURRENT_USER.set(userId);
    }

    public static Long getUserId() {
        return CURRENT_USER.get();
    }

    public static void clear() {
        CURRENT_USER.remove();
    }
}