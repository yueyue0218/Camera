package com.action.camera.admin;

import com.action.camera.admin.domain.ModerationStatus;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.demand.domain.Demand;
import com.action.camera.demand.domain.DemandStatus;
import com.action.camera.demand.repository.DemandRepository;
import com.action.camera.report.domain.Report;
import com.action.camera.report.domain.ReportResolution;
import com.action.camera.report.domain.ReportStatus;
import com.action.camera.report.domain.ReportTargetType;
import com.action.camera.report.repository.ReportRepository;
import com.action.camera.servicepackage.domain.ServicePackage;
import com.action.camera.servicepackage.domain.ServicePackageStatus;
import com.action.camera.servicepackage.repository.ServicePackageRepository;
import com.action.camera.social.domain.MomentPost;
import com.action.camera.social.domain.MomentStatus;
import com.action.camera.social.repository.MomentPostRepository;
import jakarta.persistence.LockModeType;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = "spring.http.client.factory=simple")
@ActiveProfiles("smoke")
@Transactional
class AdminGovernanceModelTest {

    @Autowired
    private ReportRepository reportRepository;

    @Test
    void newContentDefaultsToVisibleModeration() {
        assertThat(new Demand().getModerationStatus()).isEqualTo(ModerationStatus.VISIBLE);
        assertThat(new ServicePackage().getModerationStatus()).isEqualTo(ModerationStatus.VISIBLE);
        assertThat(new MomentPost().getModerationStatus()).isEqualTo(ModerationStatus.VISIBLE);
    }

    @Test
    void demandTakeDownAndRestoreDoNotChangeBusinessStatus() {
        Demand demand = new Demand();
        demand.setStatus(DemandStatus.OPEN);
        LocalDateTime hiddenAt = LocalDateTime.of(2026, 9, 1, 10, 0);

        demand.takeDown(91L, "  duplicated listing  ", hiddenAt);

        assertThat(demand.getModerationStatus()).isEqualTo(ModerationStatus.HIDDEN);
        assertThat(demand.getModeratedBy()).isEqualTo(91L);
        assertThat(demand.getModeratedAt()).isEqualTo(hiddenAt);
        assertThat(demand.getModerationReason()).isEqualTo("duplicated listing");
        assertThat(demand.getStatus()).isEqualTo(DemandStatus.OPEN);

        LocalDateTime restoredAt = hiddenAt.plusHours(1);
        demand.restore(92L, "  appeal accepted  ", restoredAt);

        assertThat(demand.getModerationStatus()).isEqualTo(ModerationStatus.VISIBLE);
        assertThat(demand.getModeratedBy()).isEqualTo(92L);
        assertThat(demand.getModeratedAt()).isEqualTo(restoredAt);
        assertThat(demand.getModerationReason()).isEqualTo("appeal accepted");
        assertThat(demand.getStatus()).isEqualTo(DemandStatus.OPEN);
    }

    @Test
    void servicePackageTakeDownAndRestoreDoNotChangeBusinessStatus() {
        ServicePackage servicePackage = new ServicePackage();
        servicePackage.setStatus(ServicePackageStatus.ONLINE);
        LocalDateTime hiddenAt = LocalDateTime.of(2026, 9, 1, 11, 0);

        servicePackage.takeDown(91L, "policy violation", hiddenAt);
        assertThat(servicePackage.getModerationStatus()).isEqualTo(ModerationStatus.HIDDEN);
        assertThat(servicePackage.getStatus()).isEqualTo(ServicePackageStatus.ONLINE);

        servicePackage.restore(92L, "review corrected", hiddenAt.plusMinutes(30));
        assertThat(servicePackage.getModerationStatus()).isEqualTo(ModerationStatus.VISIBLE);
        assertThat(servicePackage.getStatus()).isEqualTo(ServicePackageStatus.ONLINE);
    }

    @Test
    void momentTakeDownAndRestoreDoNotChangeBusinessStatus() {
        MomentPost moment = new MomentPost();
        moment.setStatus(MomentStatus.PUBLISHED);
        LocalDateTime hiddenAt = LocalDateTime.of(2026, 9, 1, 12, 0);

        moment.takeDown(91L, "unsafe content", hiddenAt);
        assertThat(moment.getModerationStatus()).isEqualTo(ModerationStatus.HIDDEN);
        assertThat(moment.getStatus()).isEqualTo(MomentStatus.PUBLISHED);

        moment.restore(92L, "false positive", hiddenAt.plusMinutes(20));
        assertThat(moment.getModerationStatus()).isEqualTo(ModerationStatus.VISIBLE);
        assertThat(moment.getStatus()).isEqualTo(MomentStatus.PUBLISHED);
    }

    @Test
    void repeatedModerationTransitionIsRejected() {
        Demand demand = new Demand();
        demand.takeDown(91L, "reason", LocalDateTime.now());

        assertThatThrownBy(() -> demand.takeDown(91L, "again", LocalDateTime.now()))
                .isInstanceOf(BusinessException.class)
                .satisfies(error -> assertThat(((BusinessException) error).getErrorCode())
                        .isEqualTo(ErrorCode.STATUS_CONFLICT));
    }

    @Test
    void pendingReportUsesStableActiveDedupeKey() {
        LocalDateTime createdAt = LocalDateTime.of(2026, 9, 1, 13, 0);

        Report report = Report.create(
                7L,
                ReportTargetType.MOMENT,
                31L,
                "spam",
                "same advertisement repeated",
                createdAt);

        assertThat(report.getStatus()).isEqualTo(ReportStatus.PENDING);
        assertThat(report.getActiveDedupeKey()).isEqualTo("7:MOMENT:31");
        assertThat(report.getCreatedAt()).isEqualTo(createdAt);
        assertThat(report.getUpdatedAt()).isEqualTo(createdAt);
    }

    @Test
    void resolvingReportClearsDedupeKeyAndStoresResolution() {
        LocalDateTime createdAt = LocalDateTime.of(2026, 9, 1, 13, 0);
        LocalDateTime resolvedAt = createdAt.plusHours(2);
        Report report = Report.create(
                7L,
                ReportTargetType.REVIEW,
                42L,
                "abuse",
                null,
                createdAt);

        report.resolve(99L, ReportResolution.REVIEW_HIDDEN, "  confirmed abuse  ", resolvedAt);

        assertThat(report.getStatus()).isEqualTo(ReportStatus.RESOLVED);
        assertThat(report.getAdminId()).isEqualTo(99L);
        assertThat(report.getResolution()).isEqualTo(ReportResolution.REVIEW_HIDDEN);
        assertThat(report.getAdminComment()).isEqualTo("confirmed abuse");
        assertThat(report.getResolvedAt()).isEqualTo(resolvedAt);
        assertThat(report.getUpdatedAt()).isEqualTo(resolvedAt);
        assertThat(report.getActiveDedupeKey()).isNull();
    }

    @Test
    void reportRepositoryLocksReportForResolution() throws Exception {
        Report saved = reportRepository.saveAndFlush(Report.create(
                8L,
                ReportTargetType.DEMAND,
                51L,
                "spam",
                null,
                LocalDateTime.of(2026, 9, 1, 14, 0)));

        assertThat(reportRepository.findByIdForUpdate(saved.getId())).contains(saved);
        assertPessimisticWriteLock(DemandRepository.class);
        assertPessimisticWriteLock(ServicePackageRepository.class);
        assertPessimisticWriteLock(MomentPostRepository.class);
        assertPessimisticWriteLock(ReportRepository.class);
    }

    private void assertPessimisticWriteLock(Class<?> repositoryType) throws Exception {
        Method method = repositoryType.getMethod("findByIdForUpdate", Long.class);
        Lock lock = method.getAnnotation(Lock.class);

        assertThat(lock).as(repositoryType.getSimpleName() + " lock annotation").isNotNull();
        assertThat(lock.value()).isEqualTo(LockModeType.PESSIMISTIC_WRITE);
    }
}
