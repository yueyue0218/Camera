package com.action.camera.admin;

import com.action.camera.admin.domain.ModerationStatus;
import com.action.camera.admin.dto.AdminModerationFilter;
import com.action.camera.admin.dto.AdminMomentResponse;
import com.action.camera.admin.repository.AuditRecordRepository;
import com.action.camera.admin.service.AdminMomentService;
import com.action.camera.admin.service.ContentModerationService;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.page.PageResult;
import com.action.camera.report.domain.Report;
import com.action.camera.report.domain.ReportResolution;
import com.action.camera.report.domain.ReportTargetType;
import com.action.camera.report.repository.ReportRepository;
import com.action.camera.social.domain.MomentPost;
import com.action.camera.social.domain.MomentStatus;
import com.action.camera.social.repository.MomentPostRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.groups.Tuple.tuple;

@SpringBootTest(properties = "spring.http.client.factory=simple")
@ActiveProfiles("smoke")
class AdminMomentModerationServiceTest {

    private static final Long ADMIN_ID = 92301L;
    private static final Long AUTHOR_ID = 92302L;
    private static final Long REPORTER_ID = 92303L;

    @Autowired
    private AdminMomentService adminMomentService;

    @Autowired
    private ContentModerationService contentModerationService;

    @Autowired
    private MomentPostRepository momentPostRepository;

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
        momentPostRepository.deleteAll();
        jdbcTemplate.update("DELETE FROM users WHERE id IN (?, ?, ?)", ADMIN_ID, AUTHOR_ID, REPORTER_ID);
        insertUser(ADMIN_ID, "admin-moment", "ADMIN");
        insertUser(AUTHOR_ID, "author-moment", "CUSTOMER");
        insertUser(REPORTER_ID, "reporter-moment", "PROVIDER");
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    void nonAdminCannotListAdminMoments() {
        UserContext.setUserId(AUTHOR_ID);

        assertThatThrownBy(() -> adminMomentService.list(
                AdminModerationFilter.ALL, null, null, 1, 20))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    void adminCanFilterVisibleHiddenAndReportedMoments() {
        MomentPost visible = saveMoment("Older visible", LocalDateTime.of(2026, 9, 1, 9, 0));
        MomentPost deleted = saveMoment("Deleted business state", LocalDateTime.of(2026, 9, 1, 8, 0));
        deleted.markDeleted();
        momentPostRepository.saveAndFlush(deleted);
        MomentPost hidden = saveMoment("Newer hidden", LocalDateTime.of(2026, 9, 1, 11, 0));
        hidden.takeDown(ADMIN_ID, "policy", LocalDateTime.of(2026, 9, 1, 12, 0));
        momentPostRepository.saveAndFlush(hidden);
        MomentPost reported = saveMoment("Reported keyword", LocalDateTime.of(2026, 9, 1, 10, 0));
        reportRepository.saveAndFlush(Report.create(
                REPORTER_ID, ReportTargetType.MOMENT, reported.getId(), "spam", null,
                LocalDateTime.of(2026, 9, 1, 12, 1)));
        Report resolved = Report.create(
                REPORTER_ID, ReportTargetType.MOMENT, visible.getId(), "old report", null,
                LocalDateTime.of(2026, 9, 1, 12, 2));
        resolved.resolve(ADMIN_ID, ReportResolution.IGNORE, "not confirmed",
                LocalDateTime.of(2026, 9, 1, 12, 3));
        reportRepository.saveAndFlush(resolved);
        UserContext.setUserId(ADMIN_ID);

        PageResult<AdminMomentResponse> firstPage = adminMomentService.list(
                AdminModerationFilter.ALL, null, null, 1, 2);
        PageResult<AdminMomentResponse> visiblePage = adminMomentService.list(
                AdminModerationFilter.VISIBLE, null, null, 1, 20);
        PageResult<AdminMomentResponse> hiddenPage = adminMomentService.list(
                AdminModerationFilter.HIDDEN, null, null, 1, 20);
        PageResult<AdminMomentResponse> reportedPage = adminMomentService.list(
                AdminModerationFilter.REPORTED, null, "keyword", 1, 20);
        PageResult<AdminMomentResponse> authorPage = adminMomentService.list(
                AdminModerationFilter.ALL, AUTHOR_ID, null, 1, 20);

        assertThat(firstPage.getTotal()).isEqualTo(4);
        assertThat(firstPage.getRecords()).extracting(AdminMomentResponse::momentId)
                .containsExactly(hidden.getId(), reported.getId());
        assertThat(visiblePage.getRecords()).extracting(AdminMomentResponse::momentId)
                .containsExactly(reported.getId(), visible.getId(), deleted.getId());
        assertThat(visiblePage.getRecords())
                .filteredOn(response -> response.momentId().equals(deleted.getId()))
                .extracting(AdminMomentResponse::businessStatus)
                .containsExactly(MomentStatus.DELETED.name());
        assertThat(hiddenPage.getRecords()).extracting(AdminMomentResponse::momentId)
                .containsExactly(hidden.getId());
        assertThat(reportedPage.getRecords()).extracting(
                        AdminMomentResponse::momentId, AdminMomentResponse::pendingReportCount)
                .containsExactly(tuple(reported.getId(), 1L));
        assertThat(authorPage.getRecords()).hasSize(4);
    }

    @Test
    void takeDownMomentRequiresReasonAndWritesAudit() {
        MomentPost moment = saveMoment("Take down", LocalDateTime.of(2026, 9, 1, 9, 0));
        UserContext.setUserId(ADMIN_ID);

        assertThatThrownBy(() -> contentModerationService.takeDownMoment(moment.getId(), "  "))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.VALIDATION_ERROR);
        assertThat(auditRecordRepository.count()).isZero();

        AdminMomentResponse response = contentModerationService.takeDownMoment(
                moment.getId(), "  harmful content  ");

        assertThat(response.moderationStatus()).isEqualTo(ModerationStatus.HIDDEN.name());
        assertThat(momentPostRepository.findById(moment.getId()).orElseThrow().getStatus())
                .isEqualTo(MomentStatus.PUBLISHED);
        assertThat(auditRecordRepository.findAll())
                .extracting("auditType", "targetId", "adminId", "auditResult", "remark")
                .containsExactly(tuple("MOMENT", moment.getId(), ADMIN_ID, "TAKE_DOWN", "harmful content"));
    }

    @Test
    void takeDownKeepsMomentPublishedAndRestoreMakesItPublicAgain() {
        MomentPost moment = saveMoment("Restore", LocalDateTime.of(2026, 9, 1, 9, 0));
        UserContext.setUserId(ADMIN_ID);

        contentModerationService.takeDownMoment(moment.getId(), "initial decision");
        AdminMomentResponse restored = contentModerationService.restoreMoment(
                moment.getId(), "appeal accepted");

        MomentPost stored = momentPostRepository.findById(moment.getId()).orElseThrow();
        assertThat(stored.getStatus()).isEqualTo(MomentStatus.PUBLISHED);
        assertThat(stored.getDeletedAt()).isNull();
        assertThat(restored.businessStatus()).isEqualTo(MomentStatus.PUBLISHED.name());
        assertThat(restored.moderationStatus()).isEqualTo(ModerationStatus.VISIBLE.name());
        assertThat(auditRecordRepository.findAll())
                .extracting("auditResult", "remark")
                .containsExactly(tuple("TAKE_DOWN", "initial decision"), tuple("RESTORE", "appeal accepted"));
    }

    @Test
    void repeatedMomentTransitionFailsWithoutExtraAudit() {
        MomentPost moment = saveMoment("Repeated", LocalDateTime.of(2026, 9, 1, 9, 0));
        UserContext.setUserId(ADMIN_ID);
        contentModerationService.takeDownMoment(moment.getId(), "first decision");

        assertThatThrownBy(() -> contentModerationService.takeDownMoment(moment.getId(), "again"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.STATUS_CONFLICT);
        assertThat(auditRecordRepository.count()).isEqualTo(1);
    }

    private MomentPost saveMoment(String title, LocalDateTime createdAt) {
        MomentPost moment = new MomentPost();
        moment.setAuthorId(AUTHOR_ID);
        moment.setAuthorRole("CUSTOMER");
        moment.setTitle(title);
        moment.setContent(title + " content");
        moment.setStatus(MomentStatus.PUBLISHED);
        moment.setCreatedAt(createdAt);
        moment.setUpdatedAt(createdAt);
        moment.replaceImages(List.of("img-" + title));
        return momentPostRepository.saveAndFlush(moment);
    }

    private void insertUser(Long id, String nickname, String role) {
        jdbcTemplate.update("""
                INSERT INTO users (id, nickname, current_role, status, credit_score, created_at, updated_at)
                VALUES (?, ?, ?, 'ACTIVE', 80.00, NOW(), NOW())
                """, id, nickname, role);
    }
}
