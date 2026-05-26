package com.action.camera.common.config;

import com.action.camera.common.interceptor.AuthInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 注册拦截器，并配置哪些路径不需要登录（白名单）。
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final AuthInterceptor authInterceptor;

    public WebMvcConfig(AuthInterceptor authInterceptor) {
        this.authInterceptor = authInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor)
                .addPathPatterns("/**")          // 拦截所有
                .excludePathPatterns(            // 这些免登录
                        "/test/success",
                        "/test/error",
                        "/test/upload",
                        "/auth/**",              // 登录/验证码
                        "/users/register",       // 注册
                        "/users/login"           // 登录
                );
    }
}