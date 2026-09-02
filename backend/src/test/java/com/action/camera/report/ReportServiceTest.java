package com.action.camera.report;

import com.action.camera.admin.dto.AdminHallItemType;
import com.action.camera.admin.service.AdminAuditService;
import com.action.camera.admin.service.AdminPermissionService;
import com.action.camera.admin.service.AdminUserService;
import com.action.camera.admin.service.ContentModerationService;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.report.domain.Report;
import com.action.camera.report.domain.ReportResolution;
import com.action.camera.report.domain.ReportTargetType;
import com.action.camera.report.dto.ReportCreateRequest;
import com.action.camera.report.dto.ReportResolveRequest;
import com.action.camera.report.repository.ReportRepository;
import com.action.camera.report.service.ReportService;
import com.action.camera.report.service.ReportTargetValidator;
import com.action.camera.review.service.ReviewModerationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReportServiceTest {

    @Mock ReportRepository reportRepository;
    @Mock ReportTargetValidator targetValidator;
    @Mock AdminPermissionService adminPermissionService;
    @Mock ContentModerationService contentModerationService;
    @Mock AdminUserService adminUserService;
    @Mock ReviewModerationService reviewModerationService;
    @Mock AdminAuditService adminAuditService;

    private ReportService service;

    @BeforeEach
    void setUp() {
        service = new ReportService(reportRepository, targetValidator, adminPermissionService,
                contentModerationService, adminUserService, reviewModerationService, adminAuditService);
        UserContext.setUserId(11L);
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    void authenticatedUserCanReportEachExistingTargetType() {
        when(reportRepository.save(any(Report.class))).thenAnswer(invocation -> {
            Report report = invocation.getArgument(0);
            ReflectionTestUtils.setField(report, "id", 90L);
            return report;
        });

        for (ReportTargetType targetType : ReportTargetType.values()) {
            assertThat(service.create(new ReportCreateRequest(targetType.name(), 21L, " abuse ", " details ")))
                    .satisfies(response -> {
                        assertThat(response.targetType()).isEqualTo(targetType.name());
                        assertThat(response.status()).isEqualTo("PENDING");
                    });
        }

        verify(targetValidator, times(5)).validateReportable(any(), eq(21L), eq(11L));
    }

    @Test
    void createRequiresReasonAndLimitsDescription() {
        UserContext.clear();
        assertError(() -> service.create(new ReportCreateRequest("USER", 21L, "reason", null)),
                ErrorCode.UNAUTHORIZED);

        UserContext.setUserId(11L);
        assertError(() -> service.create(new ReportCreateRequest("USER", 21L, " ", null)),
                ErrorCode.VALIDATION_ERROR);
        assertError(() -> service.create(new ReportCreateRequest("USER", 21L, "x".repeat(501), null)),
                ErrorCode.VALIDATION_ERROR);
        assertError(() -> service.create(new ReportCreateRequest("USER", 21L, "reason", "x".repeat(1001))),
                ErrorCode.VALIDATION_ERROR);
    }

    @Test
    void createRejectsMissingOrUnreportableTarget() {
        org.mockito.Mockito.doThrow(new BusinessException(ErrorCode.NOT_FOUND, "missing"))
                .when(targetValidator).validateReportable(ReportTargetType.USER, 21L, 11L);

        assertError(() -> service.create(new ReportCreateRequest("USER", 21L, "reason", null)),
                ErrorCode.NOT_FOUND);
        verify(reportRepository, never()).save(any());
    }

    @Test
    void duplicatePendingReportIsRejectedWithoutSecondRow() {
        String key = "11:USER:21";
        when(reportRepository.findByActiveDedupeKey(key)).thenReturn(Optional.of(report(7L, ReportTargetType.USER)));
        assertError(() -> service.create(new ReportCreateRequest("USER", 21L, "reason", null)),
                ErrorCode.DUPLICATE_OPERATION);

        when(reportRepository.findByActiveDedupeKey(key)).thenReturn(Optional.empty());
        when(reportRepository.save(any())).thenThrow(new DataIntegrityViolationException("race"));
        assertError(() -> service.create(new ReportCreateRequest("USER", 21L, "reason", null)),
                ErrorCode.DUPLICATE_OPERATION);
    }

    @Test
    void reporterCanListOnlyOwnReports() {
        when(reportRepository.findByReporterIdOrderByCreatedAtDesc(11L))
                .thenReturn(List.of(report(7L, ReportTargetType.USER)));
        assertThat(service.listMine()).extracting("reportId").containsExactly(7L);
        verify(reportRepository).findByReporterIdOrderByCreatedAtDesc(11L);
    }

    @Test
    void nonAdminCannotListReadOrResolveAdminReports() {
        when(adminPermissionService.requireAdmin()).thenThrow(new BusinessException(ErrorCode.FORBIDDEN));
        assertError(() -> service.listForAdmin(null, null, null, 1, 20), ErrorCode.FORBIDDEN);
        assertError(() -> service.adminDetail(7L), ErrorCode.FORBIDDEN);
        assertError(() -> service.resolve(7L, new ReportResolveRequest("IGNORE", "checked")),
                ErrorCode.FORBIDDEN);
    }

    @Test
    void adminListFiltersTargetStatusKeywordAndPages() {
        when(adminPermissionService.requireAdmin()).thenReturn(99L);
        Report row = report(7L, ReportTargetType.USER);
        when(reportRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(row), PageRequest.of(1, 5), 6));

        var result = service.listForAdmin(" user ", " pending ", " 21 ", 2, 5);

        assertThat(result.getRecords()).extracting("reportId").containsExactly(7L);
        assertThat(result.getPage()).isEqualTo(2);
        assertThat(result.getSize()).isEqualTo(5);
        assertThat(result.getTotal()).isEqualTo(6);
    }

    @Test
    void ignoreResolvesWithoutMutatingTargetAndWritesAudit() {
        arrangePendingReport(ReportTargetType.USER);

        var response = service.resolve(7L, new ReportResolveRequest("IGNORE", " no violation "));

        assertThat(response.status()).isEqualTo("RESOLVED");
        assertThat(response.resolution()).isEqualTo("IGNORE");
        verify(adminAuditService).record("REPORT", 7L, 99L, "RESOLVE", "IGNORE: no violation");
        verifyNoTargetMutation();
    }

    @Test
    void takeDownResolutionUsesContentModerationServiceAndWritesBothAudits() {
        assertDelegates(ReportTargetType.DEMAND, ReportResolution.TAKE_DOWN,
                () -> verify(contentModerationService)
                        .takeDownHallItem(AdminHallItemType.DEMAND, 21L, "reason"));
    }

    @Test
    void restoreResolutionUsesContentModerationService() {
        assertDelegates(ReportTargetType.SERVICE_PACKAGE, ReportResolution.RESTORE,
                () -> verify(contentModerationService)
                        .restoreHallItem(AdminHallItemType.SERVICE_PACKAGE, 21L, "reason"));
    }

    @Test
    void restrictUserResolutionUsesAdminUserService() {
        assertDelegates(ReportTargetType.USER, ReportResolution.RESTRICT_USER,
                () -> verify(adminUserService).changeStatus(21L, "DISABLED", "reason"));
    }

    @Test
    void reviewHiddenResolutionUsesReviewModerationService() {
        assertDelegates(ReportTargetType.REVIEW, ReportResolution.REVIEW_HIDDEN,
                () -> verify(reviewModerationService).hideForGovernance(21L, 99L, "REPORT", 7L, "reason"));
    }

    @Test
    void incompatibleResolutionTargetPairIsRejectedBeforeMutation() {
        arrangePendingReport(ReportTargetType.USER);
        assertError(() -> service.resolve(7L, new ReportResolveRequest("TAKE_DOWN", "reason")),
                ErrorCode.VALIDATION_ERROR);
        verify(reportRepository, never()).save(any());
        verify(adminAuditService, never()).record(any(), any(), any(), any(), any());
        verifyNoTargetMutation();
    }

    @Test
    void resolvingAlreadyResolvedReportFailsWithoutAdditionalAudit() {
        Report resolved = report(7L, ReportTargetType.USER);
        resolved.resolve(99L, ReportResolution.IGNORE, "done", LocalDateTime.now());
        when(adminPermissionService.requireAdmin()).thenReturn(99L);
        when(reportRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(resolved));

        assertError(() -> service.resolve(7L, new ReportResolveRequest("IGNORE", "again")),
                ErrorCode.STATUS_CONFLICT);
        verify(adminAuditService, never()).record(any(), any(), any(), any(), any());
    }

    @Test
    void failedTargetMutationRollsBackReportAndAuditRows() {
        arrangePendingReport(ReportTargetType.MOMENT);
        when(contentModerationService.takeDownMoment(21L, "reason"))
                .thenThrow(new BusinessException(ErrorCode.STATUS_CONFLICT, "target changed"));

        assertError(() -> service.resolve(
                7L, new ReportResolveRequest("TAKE_DOWN", "reason")), ErrorCode.STATUS_CONFLICT);

        verify(reportRepository, never()).save(any());
        verify(adminAuditService, never()).record(any(), any(), any(), any(), any());
    }

    private void assertDelegates(ReportTargetType targetType, ReportResolution resolution, Runnable verification) {
        org.mockito.Mockito.reset(contentModerationService, adminUserService, reviewModerationService,
                adminAuditService, reportRepository, adminPermissionService);
        arrangePendingReport(targetType);
        service.resolve(7L, new ReportResolveRequest(resolution.name(), " reason "));
        verification.run();
        verify(adminAuditService).record("REPORT", 7L, 99L, "RESOLVE", resolution.name() + ": reason");
    }

    private void arrangePendingReport(ReportTargetType targetType) {
        when(adminPermissionService.requireAdmin()).thenReturn(99L);
        when(reportRepository.findByIdForUpdate(7L)).thenReturn(Optional.of(report(7L, targetType)));
        org.mockito.Mockito.lenient().when(reportRepository.save(any(Report.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    private Report report(Long id, ReportTargetType targetType) {
        Report report = Report.create(11L, targetType, 21L, "reason", null, LocalDateTime.now());
        ReflectionTestUtils.setField(report, "id", id);
        return report;
    }

    private void verifyNoTargetMutation() {
        verify(contentModerationService, never()).takeDownHallItem(any(), any(), any());
        verify(contentModerationService, never()).restoreHallItem(any(), any(), any());
        verify(contentModerationService, never()).takeDownMoment(any(), any());
        verify(contentModerationService, never()).restoreMoment(any(), any());
        verify(adminUserService, never()).changeStatus(any(), any(), any());
        verify(reviewModerationService, never()).hideForGovernance(any(), any(), any(), any(), any());
    }

    private void assertError(org.assertj.core.api.ThrowableAssert.ThrowingCallable call, ErrorCode code) {
        assertThatThrownBy(call).isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(code);
    }
}
