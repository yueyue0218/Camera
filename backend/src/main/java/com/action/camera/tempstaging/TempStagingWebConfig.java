package com.action.camera.tempstaging;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(prefix = "camera.sms", name = "staging-dypns-enabled", havingValue = "false", matchIfMissing = true)
@Profile("temp-staging")
public class TempStagingWebConfig implements WebMvcConfigurer {

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
                    @Override
                    public boolean preHandle(HttpServletRequest request,
                                             HttpServletResponse response,
                                             Object handler) {
                        throw new BusinessException(
                                ErrorCode.STATUS_CONFLICT,
                                "临时测试环境不提供真实短信登录，请使用测试账号入口");
                    }
                })
                .addPathPatterns(
                        "/auth/sms/send",
                        "/auth/sms/verify",
                        "/auth/native/sms/verify"
                )
                .order(Integer.MIN_VALUE);
    }
}
