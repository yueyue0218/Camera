package com.action.camera.common.interceptor;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.JwtUtil;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.security.UserRole;
import com.action.camera.domain.User;
import com.action.camera.repository.UserRepository;
import com.action.camera.repository.UserRoleBindingRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthInterceptorTest {

    @Mock
    private JwtUtil jwtUtil;
    @Mock
    private UserRepository userRepository;
    @Mock
    private UserRoleBindingRepository userRoleBindingRepository;
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

        AuthInterceptor interceptor = new AuthInterceptor(jwtUtil, userRepository, userRoleBindingRepository);

        assertThat(interceptor.preHandle(request, response, new Object())).isTrue();
        assertThat(UserContext.getUserId()).isNull();
    }

    @Test
    void activeBearerUserPopulatesContextAfterDatabaseStatusCheck() {
        stubBearer("GET", "/notifications", 41L, user(41L, "CUSTOMER", "ACTIVE"));
        when(userRoleBindingRepository.existsByUserIdAndRole(41L, "ADMIN")).thenReturn(false);

        assertThat(interceptor().preHandle(request, response, new Object())).isTrue();
        assertThat(UserContext.getUserId()).isEqualTo(41L);
        assertThat(UserContext.getCurrentRole()).isEqualTo(UserRole.CUSTOMER);
        assertThat(UserContext.isAdmin()).isFalse();
    }

    @Test
    void disabledBearerUserIsUnauthorizedAndNeverPopulatesContext() {
        stubBearer("GET", "/notifications", 42L, user(42L, "CUSTOMER", "DISABLED"));

        assertUnauthorizedAndEmptyContext(interceptor());
    }

    @Test
    void missingBearerUserIsUnauthorizedAndNeverPopulatesContext() {
        when(request.getMethod()).thenReturn("GET");
        when(request.getRequestURI()).thenReturn("/notifications");
        when(request.getHeader("Authorization")).thenReturn("Bearer signed-token");
        when(jwtUtil.parseUserId("signed-token")).thenReturn(43L);
        when(userRepository.findById(43L)).thenReturn(Optional.empty());

        assertUnauthorizedAndEmptyContext(interceptor());
    }

    @Test
    void disabledDemoHeaderUserCannotBypassProtectedRouteStatusCheck() {
        when(request.getMethod()).thenReturn("GET");
        when(request.getRequestURI()).thenReturn("/notifications");
        when(request.getHeader("Authorization")).thenReturn("Bearer demo-token-customer-44");
        when(jwtUtil.parseUserId("demo-token-customer-44")).thenReturn(44L);
        when(userRepository.findById(44L)).thenReturn(Optional.of(user(44L, "CUSTOMER", "DISABLED")));

        assertUnauthorizedAndEmptyContext(interceptor());
    }

    @Test
    void anonymousPublicGetStillBypassesRequiredAuthentication() {
        when(request.getMethod()).thenReturn("GET");
        when(request.getRequestURI()).thenReturn("/demands");

        assertThat(interceptor().preHandle(request, response, new Object())).isTrue();
        assertThat(UserContext.getUserId()).isNull();
        assertThat(UserContext.getCurrentRole()).isNull();
        assertThat(UserContext.isAdmin()).isFalse();
    }

    @Test
    void disabledBearerOnOptionalPublicRouteDoesNotPopulateContext() {
        stubBearer("GET", "/demands", 45L, user(45L, "PROVIDER", "DISABLED"));

        assertUnauthorizedAndEmptyContext(interceptor());
    }

    private AuthInterceptor interceptor() {
        return new AuthInterceptor(jwtUtil, userRepository, userRoleBindingRepository);
    }

    private void stubBearer(String method, String uri, Long userId, User user) {
        when(request.getMethod()).thenReturn(method);
        when(request.getRequestURI()).thenReturn(uri);
        when(request.getHeader("Authorization")).thenReturn("Bearer signed-token");
        when(jwtUtil.parseUserId("signed-token")).thenReturn(userId);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
    }

    private User user(Long id, String role, String status) {
        User user = new User();
        user.setId(id);
        user.setNickname("test-user");
        user.setCurrentRole(role);
        user.setStatus(status);
        return user;
    }

    private void assertUnauthorizedAndEmptyContext(AuthInterceptor interceptor) {
        assertThatThrownBy(() -> interceptor.preHandle(request, response, new Object()))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.UNAUTHORIZED);
        assertThat(UserContext.getUserId()).isNull();
        assertThat(UserContext.getCurrentRole()).isNull();
        assertThat(UserContext.isAdmin()).isFalse();
    }
}
