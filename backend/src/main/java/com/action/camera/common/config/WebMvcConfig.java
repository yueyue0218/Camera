package com.action.camera.common.config;

import com.action.camera.common.interceptor.AuthInterceptor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@EnableConfigurationProperties(CorsProperties.class)
public class WebMvcConfig implements WebMvcConfigurer {

    private final AuthInterceptor authInterceptor;
    private final CorsProperties corsProperties;

    public WebMvcConfig(AuthInterceptor authInterceptor, CorsProperties corsProperties) {
        this.authInterceptor = authInterceptor;
        this.corsProperties = corsProperties;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor)
                .addPathPatterns("/**")
                .excludePathPatterns(
                        "/auth/send-code",
                        "/auth/sms/send",
                        "/auth/sms/verify",
                        "/auth/refresh",
                        "/auth/native/sms/verify",
                        "/auth/native/refresh",
                        "/admin/login",
                        "/users/register",
                        "/users/login",
                        "/messages/**"
                );
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns(corsProperties.getAllowedOriginPatterns().toArray(String[]::new))
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true);
    }
}
