package com.action.camera.tempstaging;

import com.action.camera.auth.service.AuthSessionService;
import com.action.camera.auth.service.SessionAuthenticationResult;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.security.UserRole;
import com.action.camera.domain.User;
import com.action.camera.repository.UserRepository;
import com.action.camera.repository.UserRoleBindingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TempStagingLoginServiceTest {

    private final TempStagingStartupGate gate = mock(TempStagingStartupGate.class);
    private final TempStagingLoginRateLimiter limiter = mock(TempStagingLoginRateLimiter.class);
    private final UserRepository users = mock(UserRepository.class);
    private final UserRoleBindingRepository roles = mock(UserRoleBindingRepository.class);
    private final AuthSessionService sessions = mock(AuthSessionService.class);
    private TempStagingLoginService service;

    @BeforeEach
    void setUp() {
        service = new TempStagingLoginService(gate, limiter, users, roles, sessions);
    }

    @Test
    void issuesCurrentSessionForAllowlistedActiveBoundNonAdminUser() {
        User user = user(101L, UserRole.CUSTOMER.name(), "correct horse battery staple");
        SessionAuthenticationResult expected = mock(SessionAuthenticationResult.class);
        when(gate.allows(101L)).thenReturn(true);
        when(users.findById(101L)).thenReturn(Optional.of(user));
        when(roles.existsByUserIdAndRole(101L, UserRole.ADMIN.name())).thenReturn(false);
        when(roles.existsByUserIdAndRole(101L, UserRole.CUSTOMER.name())).thenReturn(true);
        when(sessions.issue(user, UserRole.CUSTOMER.name(), false, "device-1", "browser"))
                .thenReturn(expected);

        SessionAuthenticationResult actual = service.login(
                new TempStagingLoginRequest(101L, "correct horse battery staple", "device-1", "browser"),
                "203.0.113.10");

        assertSame(expected, actual);
        verify(sessions).issue(user, UserRole.CUSTOMER.name(), false, "device-1", "browser");
        verify(limiter).recordSuccess(101L);
    }

    @Test
    void rejectsUserOutsideAllowlistWithoutDatabaseLookup() {
        when(gate.allows(999L)).thenReturn(false);

        assertThrows(BusinessException.class, () -> service.login(
                new TempStagingLoginRequest(999L, "password", "device-1", null),
                "203.0.113.10"));

        verify(users, never()).findById(any());
        verify(limiter).recordFailure(eq(null), eq("203.0.113.10"));
        verify(sessions, never()).issue(any(), any(), eq(false), any(), any());
    }

    @Test
    void rejectsAdminBindingEvenWithCorrectPassword() {
        User user = user(101L, UserRole.CUSTOMER.name(), "correct horse battery staple");
        when(gate.allows(101L)).thenReturn(true);
        when(users.findById(101L)).thenReturn(Optional.of(user));
        when(roles.existsByUserIdAndRole(101L, UserRole.ADMIN.name())).thenReturn(true);

        assertThrows(BusinessException.class, () -> service.login(
                new TempStagingLoginRequest(
                        101L, "correct horse battery staple", "device-1", null),
                "203.0.113.10"));

        verify(sessions, never()).issue(any(), any(), eq(false), any(), any());
    }

    private User user(Long id, String role, String password) {
        User user = new User();
        user.setId(id);
        user.setCurrentRole(role);
        user.setStatus("ACTIVE");
        user.setPasswordHash(new BCryptPasswordEncoder(4).encode(password));
        return user;
    }
}
