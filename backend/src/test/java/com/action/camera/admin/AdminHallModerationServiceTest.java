package com.action.camera.admin;

import com.action.camera.admin.domain.ModerationStatus;
import com.action.camera.admin.dto.AdminHallItemResponse;
import com.action.camera.admin.dto.AdminHallItemType;
import com.action.camera.admin.dto.AdminModerationFilter;
import com.action.camera.admin.repository.AuditRecordRepository;
import com.action.camera.admin.service.AdminHallService;
import com.action.camera.admin.service.ContentModerationService;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.page.PageResult;
import com.action.camera.demand.domain.Demand;
import com.action.camera.demand.domain.DemandStatus;
import com.action.camera.demand.repository.DemandRepository;
import com.action.camera.report.domain.Report;
import com.action.camera.report.domain.ReportResolution;
import com.action.camera.report.domain.ReportTargetType;
import com.action.camera.report.repository.ReportRepository;
import com.action.camera.servicepackage.domain.ServicePackage;
import com.action.camera.servicepackage.domain.ServicePackageStatus;
import com.action.camera.servicepackage.repository.ServicePackageRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.groups.Tuple.tuple;

@SpringBootTest(properties = "spring.http.client.factory=simple")
@ActiveProfiles("smoke")
class AdminHallModerationServiceTest {

    private static final Long ADMIN_ID = 92101L;
    private static final Long CUSTOMER_ID = 92102L;
    private static final Long PROVIDER_ID = 92103L;

    @Autowired
    private AdminHallService adminHallService;

    @Autowired
    private ContentModerationService contentModerationService;

    @Autowired
    private DemandRepository demandRepository;

    @Autowired
    private ServicePackageRepository servicePackageRepository;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private AuditRecordRepository auditRecordRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        UserContext.clear();
        reportRepository.deleteAll();
        auditRecordRepository.deleteAll();
        demandRepository.deleteAll();
        servicePackageRepository.deleteAll();
        jdbcTemplate.update("DELETE FROM users WHERE id IN (?, ?, ?)", ADMIN_ID, CUSTOMER_ID, PROVIDER_ID);
        insertUser(ADMIN_ID, "admin-hall", "ADMIN");
        insertUser(CUSTOMER_ID, "customer-hall", "CUSTOMER");
        insertUser(PROVIDER_ID, "provider-hall", "PROVIDER");
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    void nonAdminCannotListHallItems() {
        UserContext.setUserId(CUSTOMER_ID);

        assertThatThrownBy(() -> adminHallService.list(
                AdminHallItemType.ALL, AdminModerationFilter.ALL, null, 1, 20))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    void adminCanListVisibleAndHiddenHallItemsWithGlobalPagination() {
        Demand visibleDemand = saveDemand("Older visible demand", LocalDateTime.of(2026, 9, 1, 9, 0));
        ServicePackage hiddenService = saveService("Newer hidden service", LocalDateTime.of(2026, 9, 1, 10, 0));
        hiddenService.takeDown(ADMIN_ID, "policy", LocalDateTime.of(2026, 9, 1, 11, 0));
        servicePackageRepository.saveAndFlush(hiddenService);
        UserContext.setUserId(ADMIN_ID);

        PageResult<AdminHallItemResponse> firstPage = adminHallService.list(
                AdminHallItemType.ALL, AdminModerationFilter.ALL, null, 1, 1);
        PageResult<AdminHallItemResponse> secondPage = adminHallService.list(
                AdminHallItemType.ALL, AdminModerationFilter.ALL, null, 2, 1);
        PageResult<AdminHallItemResponse> visible = adminHallService.list(
                AdminHallItemType.ALL, AdminModerationFilter.VISIBLE, null, 1, 20);
        PageResult<AdminHallItemResponse> hidden = adminHallService.list(
                AdminHallItemType.ALL, AdminModerationFilter.HIDDEN, null, 1, 20);

        assertThat(firstPage.getTotal()).isEqualTo(2);
        assertThat(firstPage.getRecords()).extracting(AdminHallItemResponse::id)
                .containsExactly(hiddenService.getId());
        assertThat(secondPage.getRecords()).extracting(AdminHallItemResponse::id)
                .containsExactly(visibleDemand.getId());
        assertThat(visible.getRecords()).extracting(AdminHallItemResponse::id)
                .containsExactly(visibleDemand.getId());
        assertThat(hidden.getRecords()).extracting(AdminHallItemResponse::id)
                .containsExactly(hiddenService.getId());
    }

    @Test
    void reportedFilterUsesPendingReportsOnly() {
        Demand pendingTarget = saveDemand("Pending report", LocalDateTime.of(2026, 9, 1, 9, 0));
        ServicePackage resolvedTarget = saveService("Resolved report", LocalDateTime.of(2026, 9, 1, 10, 0));
        reportRepository.saveAndFlush(Report.create(
                CUSTOMER_ID, ReportTargetType.DEMAND, pendingTarget.getId(), "spam", null,
                LocalDateTime.of(2026, 9, 1, 11, 0)));
        Report resolved = Report.create(
                CUSTOMER_ID, ReportTargetType.SERVICE_PACKAGE, resolvedTarget.getId(), "spam", null,
                LocalDateTime.of(2026, 9, 1, 11, 1));
        resolved.resolve(ADMIN_ID, ReportResolution.IGNORE, "not confirmed", LocalDateTime.of(2026, 9, 1, 12, 0));
        reportRepository.saveAndFlush(resolved);
        UserContext.setUserId(ADMIN_ID);

        PageResult<AdminHallItemResponse> reported = adminHallService.list(
                AdminHallItemType.ALL, AdminModerationFilter.REPORTED, null, 1, 20);

        assertThat(reported.getRecords()).extracting(AdminHallItemResponse::id)
                .containsExactly(pendingTarget.getId());
        assertThat(reported.getRecords()).extracting(AdminHallItemResponse::pendingReportCount)
                .containsExactly(1L);
    }

    @Test
    void takeDownDemandRequiresReasonAndWritesAudit() {
        Demand demand = saveDemand("Demand to hide", LocalDateTime.of(2026, 9, 1, 9, 0));
        UserContext.setUserId(ADMIN_ID);

        assertThatThrownBy(() -> contentModerationService.takeDownHallItem(
                AdminHallItemType.DEMAND, demand.getId(), "   "))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.VALIDATION_ERROR);
        assertThat(auditRecordRepository.count()).isZero();

        AdminHallItemResponse response = contentModerationService.takeDownHallItem(
                AdminHallItemType.DEMAND, demand.getId(), "  prohibited solicitation  ");

        assertThat(response.moderationStatus()).isEqualTo(ModerationStatus.HIDDEN.name());
        assertThat(demandRepository.findById(demand.getId()).orElseThrow().getStatus()).isEqualTo(DemandStatus.OPEN);
        assertThat(auditRecordRepository.findAll())
                .extracting("auditType", "targetId", "adminId", "auditResult", "remark")
                .containsExactly(tuple("DEMAND", demand.getId(), ADMIN_ID, "TAKE_DOWN", "prohibited solicitation"));
    }

    @Test
    void restoreDemandWritesAuditAndKeepsDemandOpen() {
        Demand demand = saveDemand("Demand to restore", LocalDateTime.of(2026, 9, 1, 9, 0));
        demand.takeDown(ADMIN_ID, "initial review", LocalDateTime.of(2026, 9, 1, 10, 0));
        demandRepository.saveAndFlush(demand);
        UserContext.setUserId(ADMIN_ID);

        AdminHallItemResponse response = contentModerationService.restoreHallItem(
                AdminHallItemType.DEMAND, demand.getId(), "  appeal accepted  ");

        assertThat(response.moderationStatus()).isEqualTo(ModerationStatus.VISIBLE.name());
        assertThat(demandRepository.findById(demand.getId()).orElseThrow().getStatus()).isEqualTo(DemandStatus.OPEN);
        assertThat(auditRecordRepository.findAll())
                .extracting("auditType", "targetId", "adminId", "auditResult", "remark")
                .containsExactly(tuple("DEMAND", demand.getId(), ADMIN_ID, "RESTORE", "appeal accepted"));
    }

    @Test
    void takeDownServiceWritesAuditAndKeepsServiceOnline() {
        ServicePackage servicePackage = saveService("Service to hide", LocalDateTime.of(2026, 9, 1, 9, 0));
        UserContext.setUserId(ADMIN_ID);

        AdminHallItemResponse response = contentModerationService.takeDownHallItem(
                AdminHallItemType.SERVICE_PACKAGE, servicePackage.getId(), "  misleading package  ");

        assertThat(response.moderationStatus()).isEqualTo(ModerationStatus.HIDDEN.name());
        assertThat(servicePackageRepository.findById(servicePackage.getId()).orElseThrow().getStatus())
                .isEqualTo(ServicePackageStatus.ONLINE);
        assertThat(auditRecordRepository.findAll())
                .extracting("auditType", "targetId", "adminId", "auditResult", "remark")
                .containsExactly(tuple(
                        "SERVICE_PACKAGE", servicePackage.getId(), ADMIN_ID, "TAKE_DOWN", "misleading package"));
    }

    @Test
    void repeatedHallTransitionFailsWithoutExtraAudit() {
        Demand demand = saveDemand("Repeated transition", LocalDateTime.of(2026, 9, 1, 9, 0));
        UserContext.setUserId(ADMIN_ID);
        contentModerationService.takeDownHallItem(AdminHallItemType.DEMAND, demand.getId(), "first review");

        assertThatThrownBy(() -> contentModerationService.takeDownHallItem(
                AdminHallItemType.DEMAND, demand.getId(), "second review"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.STATUS_CONFLICT);
        assertThat(auditRecordRepository.count()).isEqualTo(1);
    }

    private Demand saveDemand(String description, LocalDateTime createdAt) {
        return demandRepository.saveAndFlush(new Demand(
                CUSTOMER_ID,
                "PORTRAIT",
                List.of("natural"),
                LocalDate.of(2026, 9, 10),
                "14:00-16:00",
                "weekday afternoons",
                List.of("NEAR_1_MONTH"),
                "NJ",
                "NJU campus",
                20000,
                40000,
                description,
                List.of(),
                createdAt,
                createdAt.plusDays(30)));
    }

    private ServicePackage saveService(String title, LocalDateTime createdAt) {
        ServicePackage servicePackage = new ServicePackage();
        servicePackage.setProviderId(PROVIDER_ID);
        servicePackage.setTitle(title);
        servicePackage.setCityCode("NJ");
        servicePackage.setServiceArea("NJU campus");
        servicePackage.setScene("PORTRAIT");
        servicePackage.setStyleTags(List.of("natural"));
        servicePackage.setImages(List.of("https://cdn.example/cover.jpg"));
        servicePackage.setBasePriceCent(39900L);
        servicePackage.setDurationMinutes(120);
        servicePackage.setOriginalCount(30);
        servicePackage.setRefinedCount(9);
        servicePackage.setDeliveryDays(7);
        servicePackage.setAvailableDates(List.of(LocalDate.of(2026, 9, 10)));
        servicePackage.setPortfolioIds(List.of());
        servicePackage.setDescription("service description");
        servicePackage.setTimeDescription("weekday afternoons");
        servicePackage.setTimeTags(List.of("NEAR_1_MONTH"));
        servicePackage.setStatus(ServicePackageStatus.ONLINE);
        servicePackage.setIsAvailable(true);
        servicePackage.setCreatedAt(createdAt);
        servicePackage.setUpdatedAt(createdAt);
        return servicePackageRepository.saveAndFlush(servicePackage);
    }

    private void insertUser(Long id, String nickname, String role) {
        jdbcTemplate.update("""
                INSERT INTO users (id, nickname, current_role, status, credit_score, created_at, updated_at)
                VALUES (?, ?, ?, 'ACTIVE', 80.00, NOW(), NOW())
                """, id, nickname, role);
    }
}
