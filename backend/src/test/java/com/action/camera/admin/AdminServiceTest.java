package com.action.camera.admin;

import com.action.camera.admin.dto.AdminDashboardResponse;
import com.action.camera.admin.dto.CertificationReviewRequest;
import com.action.camera.admin.dto.CertificationReviewResponse;
import com.action.camera.admin.entity.RealNameCertification;
import com.action.camera.admin.entity.StudentCertification;
import com.action.camera.admin.repository.AuditRecordRepository;
import com.action.camera.admin.repository.RealNameCertificationRepository;
import com.action.camera.admin.repository.StudentCertificationRepository;
import com.action.camera.admin.service.AdminCertificationService;
import com.action.camera.admin.service.AdminDashboardService;
import com.action.camera.demand.domain.Demand;
import com.action.camera.demand.repository.DemandRepository;
import com.action.camera.certification.dto.CertificationRequest;
import com.action.camera.certification.dto.CertificationResponse;
import com.action.camera.certification.service.CertificationService;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.order.entity.PaymentRecord;
import com.action.camera.order.repository.PaymentRecordRepository;
import com.action.camera.notification.repository.NotificationRepository;
import com.action.camera.report.domain.Report;
import com.action.camera.report.domain.ReportResolution;
import com.action.camera.report.domain.ReportTargetType;
import com.action.camera.report.repository.ReportRepository;
import com.action.camera.review.entity.ReviewComplaint;
import com.action.camera.review.repository.ReviewComplaintRepository;
import com.action.camera.servicepackage.domain.ServicePackage;
import com.action.camera.servicepackage.repository.ServicePackageRepository;
import com.action.camera.social.domain.MomentPost;
import com.action.camera.social.repository.MomentPostRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Transactional
class AdminServiceTest {

    private static final Long ADMIN_ID = 91001L;
    private static final Long CUSTOMER_ID = 91002L;
    private static final Long PROVIDER_ID = 91003L;

    @Autowired
    private AdminDashboardService dashboardService;

    @Autowired
    private AdminCertificationService certificationService;

    @Autowired
    private CertificationService submissionService;

    @Autowired
    private RealNameCertificationRepository realNameCertificationRepository;

    @Autowired
    private StudentCertificationRepository studentCertificationRepository;

    @Autowired
    private PaymentRecordRepository paymentRecordRepository;

    @Autowired
    private ReviewComplaintRepository reviewComplaintRepository;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private DemandRepository demandRepository;

    @Autowired
    private ServicePackageRepository servicePackageRepository;

    @Autowired
    private MomentPostRepository momentPostRepository;

    @Autowired
    private AuditRecordRepository auditRecordRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        insertUser(ADMIN_ID, "admin-test", "ADMIN");
        insertUser(CUSTOMER_ID, "customer-test", "CUSTOMER");
        insertUser(PROVIDER_ID, "provider-test", "PROVIDER");
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    void dashboardReturnsAdminMetrics() {
        UserContext.setUserId(ADMIN_ID);
        savePaidPayment(10001L, "PAID-TODAY", 12345L, LocalDateTime.now());
        savePayment(10004L, "SUCCESS-TODAY", 1000L, "SUCCESS", LocalDateTime.now());
        savePaidPayment(10002L, "PAID-YESTERDAY", 8888L, LocalDateTime.now().minusDays(1));
        savePayment(10003L, "UNPAID-TODAY", 9999L, "CREATED", null);
        savePendingRealNameCertification(PROVIDER_ID);
        savePendingStudentCertification(CUSTOMER_ID);
        saveComplaint("PENDING");
        saveComplaint("PROCESSING");
        saveComplaint("RESOLVED");

        AdminDashboardResponse response = dashboardService.getDashboard();

        assertThat(response.totalUsers()).isGreaterThanOrEqualTo(3);
        assertThat(response.todayGmvCent()).isEqualTo(13345L);
        assertThat(response.pendingAuditCount()).isEqualTo(2);
        assertThat(response.pendingArbitrationCount()).isEqualTo(2);
    }

    @Test
    void dashboardCountsPendingReportsFromRealRows() {
        UserContext.setUserId(ADMIN_ID);
        saveReport(CUSTOMER_ID, ReportTargetType.DEMAND, 301L);
        saveReport(PROVIDER_ID, ReportTargetType.SERVICE_PACKAGE, 302L);
        saveResolvedReport(CUSTOMER_ID, ReportTargetType.MOMENT, 303L);

        AdminDashboardResponse response = dashboardService.getDashboard();

        assertThat(response.pendingReportCount()).isEqualTo(2L);
    }

    @Test
    void dashboardCountsHiddenContentAcrossAllThreeTables() {
        UserContext.setUserId(ADMIN_ID);
        saveHiddenDemand();
        saveHiddenServicePackage();
        saveHiddenMoment();

        AdminDashboardResponse response = dashboardService.getDashboard();

        assertThat(response.removedContentCount()).isEqualTo(3L);
    }

    @Test
    void resolvedReportsAndVisibleContentAreNotCounted() {
        UserContext.setUserId(ADMIN_ID);
        saveResolvedReport(CUSTOMER_ID, ReportTargetType.DEMAND, 401L);
        saveVisibleDemand();
        saveVisibleServicePackage();
        saveVisibleMoment();

        AdminDashboardResponse response = dashboardService.getDashboard();

        assertThat(response.pendingReportCount()).isZero();
        assertThat(response.removedContentCount()).isZero();
    }

    @Test
    void nonAdminCannotReadDashboard() {
        UserContext.setUserId(CUSTOMER_ID);

        assertThatThrownBy(() -> dashboardService.getDashboard())
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    void adminCanListRealNameCertificationsWithoutPrivateFields() {
        UserContext.setUserId(ADMIN_ID);
        RealNameCertification certification = savePendingRealNameCertification(PROVIDER_ID);

        List<CertificationReviewResponse> responses = certificationService.list("REAL_NAME", "PENDING");

        assertThat(responses)
                .extracting(CertificationReviewResponse::id)
                .contains(certification.getId());
        CertificationReviewResponse response = responses.stream()
                .filter(item -> item.id().equals(certification.getId()))
                .findFirst()
                .orElseThrow();
        assertThat(response.type()).isEqualTo("REAL_NAME");
        assertThat(response.idCardNoMasked()).isEqualTo("3201********1234");
        assertThat(response.evidenceFrontFileId()).isEqualTo(7001L);
        assertThat(response.university()).isNull();
    }

    @Test
    void adminCanReviewRealNameCertificationSubmittedByUserFlow() {
        UserContext.setUserId(ADMIN_ID);
        CertificationResponse submitted = submissionService.submit(PROVIDER_ID, realNameCertificationRequest());

        assertThat(certificationService.list("REAL_NAME", null))
                .extracting(CertificationReviewResponse::id)
                .contains(submitted.getId());

        CertificationReviewResponse reviewed = certificationService.review(
                "REAL_NAME",
                submitted.getId(),
                new CertificationReviewRequest("APPROVED", null, "manual review")
        );

        assertThat(reviewed.status()).isEqualTo("APPROVED");
        assertThat(reviewed.reviewerId()).isEqualTo(ADMIN_ID);
    }

    @Test
    void adminCanRejectStudentCertificationAndWriteAuditRecord() {
        UserContext.setUserId(ADMIN_ID);
        StudentCertification certification = savePendingStudentCertification(CUSTOMER_ID);

        CertificationReviewResponse response = certificationService.review(
                "STUDENT",
                certification.getId(),
                new CertificationReviewRequest("REJECTED", "card image is unclear", "manual review")
        );

        assertThat(response.status()).isEqualTo("REJECTED");
        assertThat(response.rejectReason()).isEqualTo("card image is unclear");
        assertThat(response.reviewerId()).isEqualTo(ADMIN_ID);
        assertThat(auditRecordRepository.findAll())
                .extracting("auditType", "targetId", "adminId", "auditResult", "remark")
                .contains(org.assertj.core.groups.Tuple.tuple(
                        "STUDENT_CERTIFICATION",
                        certification.getId(),
                        ADMIN_ID,
                        "REJECTED",
                        "manual review"
                ));
        assertThat(notificationRepository.findByUserIdOrderByCreatedAtDesc(CUSTOMER_ID))
                .extracting("type", "relatedType", "relatedId")
                .contains(org.assertj.core.groups.Tuple.tuple(
                        "CERTIFICATION_REVIEWED",
                        "STUDENT_CERTIFICATION",
                        certification.getId()
                ));
    }

    @Test
    void reviewedCertificationCannotBeReviewedAgain() {
        UserContext.setUserId(ADMIN_ID);
        StudentCertification certification = savePendingStudentCertification(CUSTOMER_ID);
        certificationService.review(
                "STUDENT",
                certification.getId(),
                new CertificationReviewRequest("APPROVED", null, null)
        );

        assertThatThrownBy(() -> certificationService.review(
                "STUDENT",
                certification.getId(),
                new CertificationReviewRequest("REJECTED", "late rejection", null)
        ))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.STATUS_CONFLICT);
    }

    private void insertUser(Long userId, String nickname, String currentRole) {
        jdbcTemplate.update("""
                INSERT INTO users (id, nickname, current_role, status, credit_score, created_at, updated_at)
                VALUES (?, ?, ?, 'ACTIVE', 80.00, NOW(), NOW())
                ON DUPLICATE KEY UPDATE nickname = VALUES(nickname), current_role = VALUES(current_role)
                """, userId, nickname, currentRole);
    }

    private RealNameCertification savePendingRealNameCertification(Long userId) {
        RealNameCertification certification = new RealNameCertification();
        certification.setUserId(userId);
        certification.setRealNameMasked("Li *");
        certification.setIdCardNoCipher(new byte[]{1, 2, 3});
        certification.setIdCardNoHash("hash-" + userId);
        certification.setIdCardNoMasked("3201********1234");
        certification.setIdCardFrontFileId(7001L);
        certification.setIdCardBackFileId(7002L);
        certification.setFaceVerifyResult("PASSED");
        certification.setStatus("PENDING");
        certification.setAppliedAt(LocalDateTime.now().minusHours(1));
        return realNameCertificationRepository.saveAndFlush(certification);
    }

    private StudentCertification savePendingStudentCertification(Long userId) {
        StudentCertification certification = new StudentCertification();
        certification.setUserId(userId);
        certification.setRealNameMasked("Zhou *");
        certification.setStudentNoCipher(new byte[]{4, 5, 6});
        certification.setStudentNoHash("student-hash-" + userId);
        certification.setUniversity("NJU");
        certification.setStudentCardFileId(8001L);
        certification.setStatus("PENDING_REVIEW");
        certification.setAppliedAt(LocalDateTime.now().minusMinutes(30));
        return studentCertificationRepository.saveAndFlush(certification);
    }

    private CertificationRequest realNameCertificationRequest() {
        CertificationRequest request = new CertificationRequest();
        request.setRealName("Li Ming");
        request.setIdCardNumber("320101200001011234");
        request.setIdCardFrontFileId(7001L);
        request.setIdCardBackFileId(7002L);
        return request;
    }

    private void savePaidPayment(Long orderId, String paymentNo, Long amountCent, LocalDateTime paidAt) {
        savePayment(orderId, paymentNo, amountCent, "PAID", paidAt);
    }

    private void savePayment(Long orderId, String paymentNo, Long amountCent, String status, LocalDateTime paidAt) {
        PaymentRecord paymentRecord = new PaymentRecord();
        paymentRecord.setPaymentNo(paymentNo);
        paymentRecord.setOrderId(orderId);
        paymentRecord.setAmountCent(amountCent);
        paymentRecord.setPayMethod("MOCK_PAY");
        paymentRecord.setStatus(status);
        paymentRecord.setRequestedAt(LocalDateTime.now().minusMinutes(5));
        paymentRecord.setPaidAt(paidAt);
        paymentRecordRepository.saveAndFlush(paymentRecord);
    }

    private void saveComplaint(String status) {
        ReviewComplaint complaint = new ReviewComplaint();
        complaint.setReviewId(1L);
        complaint.setOrderId(2L);
        complaint.setComplainantId(PROVIDER_ID);
        complaint.setRespondentId(CUSTOMER_ID);
        complaint.setReason("test complaint");
        complaint.setStatus(status);
        complaint.setCreatedAt(LocalDateTime.now());
        complaint.setUpdatedAt(LocalDateTime.now());
        reviewComplaintRepository.saveAndFlush(complaint);
    }

    private Report saveReport(Long reporterId, ReportTargetType targetType, Long targetId) {
        return reportRepository.saveAndFlush(Report.create(
                reporterId, targetType, targetId, "test report", null, LocalDateTime.now()));
    }

    private void saveResolvedReport(Long reporterId, ReportTargetType targetType, Long targetId) {
        Report report = saveReport(reporterId, targetType, targetId);
        report.resolve(ADMIN_ID, ReportResolution.IGNORE, "resolved", LocalDateTime.now());
        reportRepository.saveAndFlush(report);
    }

    private void saveHiddenDemand() {
        Demand demand = new Demand(CUSTOMER_ID, "portrait", List.of("film"), null, null,
                "test time", List.of("day"), "Nanjing", "Xuanwu", 1000, 2000,
                "test demand", List.of(), LocalDateTime.now(), null);
        demand.takeDown(ADMIN_ID, "test moderation", LocalDateTime.now());
        demandRepository.saveAndFlush(demand);
    }

    private void saveVisibleDemand() {
        Demand demand = new Demand(CUSTOMER_ID, "portrait", List.of("film"), null, null,
                "test time", List.of("day"), "Nanjing", "Xuanwu", 1000, 2000,
                "test demand", List.of(), LocalDateTime.now(), null);
        demandRepository.saveAndFlush(demand);
    }

    private void saveHiddenServicePackage() {
        ServicePackage servicePackage = newServicePackage();
        servicePackage.takeDown(ADMIN_ID, "test moderation", LocalDateTime.now());
        servicePackageRepository.saveAndFlush(servicePackage);
    }

    private void saveVisibleServicePackage() {
        servicePackageRepository.saveAndFlush(newServicePackage());
    }

    private ServicePackage newServicePackage() {
        ServicePackage servicePackage = new ServicePackage();
        servicePackage.setProviderId(PROVIDER_ID);
        servicePackage.setTitle("test service");
        servicePackage.setCityCode("Nanjing");
        servicePackage.setScene("portrait");
        servicePackage.setBasePriceCent(1000L);
        servicePackage.setDurationMinutes(60);
        servicePackage.setOriginalCount(10);
        servicePackage.setRefinedCount(5);
        servicePackage.setDeliveryDays(3);
        servicePackage.setTimeDescription("test time");
        return servicePackage;
    }

    private void saveHiddenMoment() {
        MomentPost moment = new MomentPost(PROVIDER_ID, "PROVIDER", "test moment", "test content", List.of(), List.of());
        moment.takeDown(ADMIN_ID, "test moderation", LocalDateTime.now());
        momentPostRepository.saveAndFlush(moment);
    }

    private void saveVisibleMoment() {
        momentPostRepository.saveAndFlush(
                new MomentPost(PROVIDER_ID, "PROVIDER", "test moment", "test content", List.of(), List.of()));
    }
}
