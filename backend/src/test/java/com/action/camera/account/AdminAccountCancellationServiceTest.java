package com.action.camera.account;

import com.action.camera.account.domain.AccountCancellationRequest;
import com.action.camera.account.domain.AccountCancellationStatus;
import com.action.camera.account.dto.AdminAccountCancellationResponse;
import com.action.camera.account.dto.AdminAccountCancellationUpdateRequest;
import com.action.camera.account.repository.AccountCancellationCleanupRepository;
import com.action.camera.account.repository.AccountCancellationRequestRepository;
import com.action.camera.account.service.AdminAccountCancellationService;
import com.action.camera.admin.service.AdminAuditService;
import com.action.camera.admin.service.AdminPermissionService;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.domain.User;
import com.action.camera.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminAccountCancellationServiceTest {

    @Mock
    private AdminPermissionService adminPermissionService;
    @Mock
    private AdminAuditService adminAuditService;
    @Mock
    private AccountCancellationRequestRepository requestRepository;
    @Mock
    private AccountCancellationCleanupRepository cleanupRepository;
    @Mock
    private UserRepository userRepository;

    private AdminAccountCancellationService service;
    private AccountCancellationRequest request;
    private User user;

    @BeforeEach
    void setUp() {
        service = new AdminAccountCancellationService(adminPermissionService, adminAuditService,
                requestRepository, cleanupRepository, userRepository);
        request = new AccountCancellationRequest();
        request.setId(41L);
        request.setUserId(8L);
        request.setStatus(AccountCancellationStatus.PENDING);
        request.setReason("不再使用");
        request.setRequestedAt(LocalDateTime.now().minusDays(1));
        request.setUpdatedAt(LocalDateTime.now().minusDays(1));

        user = new User();
        user.setId(8L);
        user.setStudentNo("241881001");
        user.setPasswordHash("secret");
        user.setMobileHash("mobile-hash");
        user.setMobileMasked("138****0000");
        user.setNickname("王同学");
        user.setSchool("南京大学");
        user.setCurrentRole("PROVIDER");
        user.setStatus("ACTIVE");

        when(adminPermissionService.requireAdmin()).thenReturn(99L);
        when(requestRepository.findByIdForUpdate(41L)).thenReturn(Optional.of(request));
    }

    @Test
    void completingRequestRevokesAndAnonymizesUserData() {
        when(adminPermissionService.hasAdminPermission(8L)).thenReturn(false);
        when(userRepository.findByIdForUpdate(8L)).thenReturn(Optional.of(user));
        when(cleanupRepository.countBlockingOrders(8L)).thenReturn(0L);
        when(cleanupRepository.countOpenDisputes(8L)).thenReturn(0L);

        AdminAccountCancellationResponse response = service.update(41L,
                new AdminAccountCancellationUpdateRequest("completed", "身份确认完成"));

        assertThat(response.getStatus()).isEqualTo("COMPLETED");
        assertThat(request.getProcessedAt()).isNotNull();
        assertThat(user.getStatus()).isEqualTo("DELETED");
        assertThat(user.getNickname()).isEqualTo("已注销用户-8");
        assertThat(user.getStudentNo()).isNull();
        assertThat(user.getPasswordHash()).isNull();
        assertThat(user.getMobileHash()).isNull();
        assertThat(user.getMobileMasked()).isNull();
        assertThat(user.getSchool()).isNull();
        assertThat(user.getCurrentRole()).isEqualTo("CUSTOMER");
        verify(cleanupRepository).cleanupUserData(any(Long.class), any(String.class), any(LocalDateTime.class));
        verify(userRepository).save(user);
        verify(adminAuditService).record(
                "ACCOUNT_CANCELLATION", 41L, 99L, "COMPLETED", "身份确认完成");
    }

    @Test
    void activeOrderPreventsCompletionAndLeavesAccountUntouched() {
        when(adminPermissionService.hasAdminPermission(8L)).thenReturn(false);
        when(userRepository.findByIdForUpdate(8L)).thenReturn(Optional.of(user));
        when(cleanupRepository.countBlockingOrders(8L)).thenReturn(1L);

        assertThatThrownBy(() -> service.update(41L,
                new AdminAccountCancellationUpdateRequest("COMPLETED", "准备注销")))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.STATUS_CONFLICT);

        assertThat(user.getStatus()).isEqualTo("ACTIVE");
        assertThat(request.getStatus()).isEqualTo(AccountCancellationStatus.PENDING);
        verify(cleanupRepository, never()).cleanupUserData(any(), any(), any());
        verify(userRepository, never()).save(any());
        verify(adminAuditService, never()).record(any(), any(), any(), any(), any());
    }

    @Test
    void rejectedRequestCannotBeMovedBackToProcessingByAdmin() {
        request.setStatus(AccountCancellationStatus.REJECTED);

        assertThatThrownBy(() -> service.update(41L,
                new AdminAccountCancellationUpdateRequest("PROCESSING", "重新处理")))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.STATUS_CONFLICT);
        verify(requestRepository, never()).save(any());
    }

    @Test
    void adminAccountMustLoseAdminPermissionBeforeCancellation() {
        when(adminPermissionService.hasAdminPermission(8L)).thenReturn(true);

        assertThatThrownBy(() -> service.update(41L,
                new AdminAccountCancellationUpdateRequest("COMPLETED", "准备注销")))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.STATUS_CONFLICT);
        verify(userRepository, never()).findByIdForUpdate(any());
        verify(cleanupRepository, never()).cleanupUserData(any(), any(), any());
    }
}
