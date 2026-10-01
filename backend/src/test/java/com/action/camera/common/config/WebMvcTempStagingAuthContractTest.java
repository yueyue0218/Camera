package com.action.camera.common.config;

import com.action.camera.common.interceptor.AuthInterceptor;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.web.servlet.config.annotation.InterceptorRegistration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WebMvcTempStagingAuthContractTest {

    @Test
    void tempStagingProfileAllowsUnauthenticatedRequestsToWhitelistLoginController() {
        AuthInterceptor authInterceptor = mock(AuthInterceptor.class);
        Environment environment = mock(Environment.class);
        when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(true);
        InterceptorRegistration registration = registrationFor(authInterceptor, environment);

        verify(registration).excludePathPatterns("/auth/temp-staging/login");
    }

    @Test
    void normalProfilesKeepWhitelistLoginBehindAuthenticationInterceptor() {
        AuthInterceptor authInterceptor = mock(AuthInterceptor.class);
        Environment environment = mock(Environment.class);
        when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(false);
        InterceptorRegistration registration = registrationFor(authInterceptor, environment);

        verify(registration, never()).excludePathPatterns("/auth/temp-staging/login");
    }

    private InterceptorRegistration registrationFor(AuthInterceptor authInterceptor,
                                                    Environment environment) {
        InterceptorRegistry registry = mock(InterceptorRegistry.class);
        InterceptorRegistration registration = mock(InterceptorRegistration.class);
        when(registry.addInterceptor(authInterceptor)).thenReturn(registration);
        when(registration.addPathPatterns(any(String[].class))).thenReturn(registration);
        when(registration.excludePathPatterns(any(String[].class))).thenReturn(registration);

        new WebMvcConfig(authInterceptor, new CorsProperties(), environment).addInterceptors(registry);
        return registration;
    }
}
