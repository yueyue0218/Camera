package com.action.camera.common.interceptor;

import com.action.camera.common.JwtUtil;
import com.action.camera.common.UserContext;
import com.action.camera.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthInterceptorTest {

    @Mock
    private JwtUtil jwtUtil;
    @Mock
    private UserRepository userRepository;
    @Mock
    private HttpServletRequest request;
    @Mock
    private HttpServletResponse response;

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    void anonymousFileDownloadCanReachFileAccessPolicy() {
        when(request.getMethod()).thenReturn("GET");
        when(request.getRequestURI()).thenReturn("/files/42/download");

        AuthInterceptor interceptor = new AuthInterceptor(jwtUtil, userRepository);

        assertThat(interceptor.preHandle(request, response, new Object())).isTrue();
        assertThat(UserContext.getUserId()).isNull();
    }
}
