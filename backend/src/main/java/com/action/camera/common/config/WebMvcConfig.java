package com.action.camera.common.config;

import com.action.camera.common.interceptor.AuthInterceptor;
import com.action.camera.privacy.service.PrivacyRequestInterceptor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@EnableConfigurationProperties(CorsProperties.class)
public class WebMvcConfig implements WebMvcConfigurer {

    private final AuthInterceptor authInterceptor;
    private final CorsProperties corsProperties;
    private final Environment environment;
    private final PrivacyRequestInterceptor privacyInterceptor;

    public WebMvcConfig(AuthInterceptor authInterceptor,
                        CorsProperties corsProperties,
                        Environment environment,
                        PrivacyRequestInterceptor privacyInterceptor) {
        this.authInterceptor = authInterceptor;
        this.corsProperties = corsProperties;
        this.environment = environment;
        this.privacyInterceptor = privacyInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        var registration = registry.addInterceptor(authInterceptor)
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
        registry.addInterceptor(privacyInterceptor).addPathPatterns("/**").order(1);
        if (environment.acceptsProfiles(Profiles.of("temp-staging"))) {
            registration.excludePathPatterns("/auth/temp-staging/login");
        }
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
