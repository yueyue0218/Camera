package com.action.camera.admin;

import com.action.camera.admin.dto.AdminUserDetailResponse;
import com.action.camera.admin.dto.AdminUserListItemResponse;
import com.action.camera.admin.entity.AuditRecord;
import com.action.camera.admin.entity.RealNameCertification;
import com.action.camera.admin.entity.StudentCertification;
import com.action.camera.admin.repository.AuditRecordRepository;
import com.action.camera.admin.repository.RealNameCertificationRepository;
import com.action.camera.admin.repository.StudentCertificationRepository;
import com.action.camera.admin.service.AdminUserService;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.page.PageResult;
import com.action.camera.demand.domain.Demand;
import com.action.camera.demand.repository.DemandRepository;
import com.action.camera.domain.User;
import com.action.camera.domain.UserRoleBinding;
import com.action.camera.report.domain.Report;
import com.action.camera.report.domain.ReportResolution;
import com.action.camera.report.domain.ReportTargetType;
import com.action.camera.report.repository.ReportRepository;
import com.action.camera.repository.UserRepository;
import com.action.camera.repository.UserRoleBindingRepository;
import com.action.camera.servicepackage.domain.ServicePackage;
import com.action.camera.servicepackage.domain.ServicePackageStatus;
import com.action.camera.servicepackage.repository.ServicePackageRepository;
import com.action.camera.social.domain.MomentPost;
import com.action.camera.social.domain.MomentStatus;
import com.action.camera.social.repository.MomentPostRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.groups.Tuple.tuple;

@SpringBootTest(properties = "spring.http.client.factory=simple")
@ActiveProfiles("smoke")
class AdminUserServiceTest {

    @Autowired
    private AdminUserService adminUserService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private UserRoleBindingRepository userRoleBindingRepository;
    @Autowired
    private AuditRecordRepository auditRecordRepository;
    @Autowired
    private ReportRepository reportRepository;
    @Autowired
    private StudentCertificationRepository studentCertificationRepository;
    @Autowired
    private RealNameCertificationRepository realNameCertificationRepository;
    @Autowired
    private DemandRepository demandRepository;
    @Autowired
    private ServicePackageRepository servicePackageRepository;
    @Autowired
    private MomentPostRepository momentPostRepository;
    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        UserContext.clear();
        reportRepository.deleteAll();
        auditRecordRepository.deleteAll();
        studentCertificationRepository.deleteAll();
        realNameCertificationRepository.deleteAll();
        demandRepository.deleteAll();
        servicePackageRepository.deleteAll();
        momentPostRepository.deleteAll();
        userRoleBindingRepository.deleteAll();
        userRepository.deleteAll();
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    void nonAdminCannotListUsersOrReadAdminDetail() {
        User ordinary = createUser("241881001", "ordinary", "CUSTOMER", "ACTIVE");
        UserContext.setUserId(ordinary.getId());

        assertForbidden(() -> adminUserService.list(null, null, null, 1, 20));
        assertForbidden(() -> adminUserService.detail(ordinary.getId()));
    }

    @Test
    void adminListSupportsKeywordRoleStatusAndOneBasedPaging() {
        createAdminContext("241881002");
        User alice = createUser("241881003", "Alice Lens", "CUSTOMER", "ACTIVE");
        User bob = createUser("241881004", "Bob Frame", "PROVIDER", "DISABLED");

        PageResult<AdminUserListItemResponse> first = adminUserService.list(null, null, null, 1, 1);
        PageResult<AdminUserListItemResponse> second = adminUserService.list(null, null, null, 2, 1);
        PageResult<AdminUserListItemResponse> byName = adminUserService.list(" alice ", null, null, 1, 20);
        PageResult<AdminUserListItemResponse> byId = adminUserService.list(
                bob.getId().toString(), null, null, 1, 20);
        PageResult<AdminUserListItemResponse> byStudentNo = adminUserService.list(
                "241881004", null, null, 1, 20);
        PageResult<AdminUserListItemResponse> disabledProviders = adminUserService.list(
                null, "PROVIDER", "DISABLED", 1, 20);

        assertThat(first.getTotal()).isEqualTo(3);
        assertThat(first.getRecords()).hasSize(1);
        assertThat(second.getRecords()).hasSize(1);
        assertThat(second.getRecords().get(0).userId()).isNotEqualTo(first.getRecords().get(0).userId());
        assertThat(byName.getRecords()).extracting(AdminUserListItemResponse::userId).containsExactly(alice.getId());
        assertThat(byId.getRecords()).extracting(AdminUserListItemResponse::userId).containsExactly(bob.getId());
        assertThat(byStudentNo.getRecords()).extracting(AdminUserListItemResponse::userId).containsExactly(bob.getId());
        assertThat(disabledProviders.getRecords()).extracting(
                        AdminUserListItemResponse::userId,
                        AdminUserListItemResponse::status,
                        AdminUserListItemResponse::currentRole)
                .containsExactly(tuple(bob.getId(), "DISABLED", "PROVIDER"));
    }

    @Test
    void adminRoleFilterUsesCurrentRoleAndRoleBindingsAsAUnion() {
        User caller = createAdminContext("241881005");
        User directAdmin = createUser("241881006", "direct-admin", "ADMIN", "ACTIVE");
        User boundAdmin = createUser("241881007", "bound-admin", "PROVIDER", "ACTIVE");
        User ordinary = createUser("241881008", "ordinary-provider", "PROVIDER", "ACTIVE");
        grantAdmin(boundAdmin);

        PageResult<AdminUserListItemResponse> admins = adminUserService.list(
                null, "ADMIN", "ACTIVE", 1, 20);

        assertThat(admins.getRecords()).extracting(AdminUserListItemResponse::userId)
                .containsExactlyInAnyOrder(caller.getId(), directAdmin.getId(), boundAdmin.getId())
                .doesNotContain(ordinary.getId());
        assertThat(admins.getRecords()).allMatch(AdminUserListItemResponse::admin);
    }

    @Test
    void detailDoesNotExposeCredentialOrIdentitySecrets() throws Exception {
        User admin = createAdminContext("241881009");
        User target = createUser("241881010", "detail-target", "PROVIDER", "ACTIVE");
        target.setPasswordHash("never-return-this-password-hash");
        target.setBio("public bio");
        target.setSchool("南京大学");
        target.setCityCode("NJ");
        userRepository.saveAndFlush(target);
        saveStudentCertification(target.getId());
        saveRealNameCertification(target.getId());
        saveDemand(target.getId());
        saveService(target.getId());
        saveMoment(target.getId());
        Report resolved = Report.create(admin.getId(), ReportTargetType.USER, target.getId(),
                "resolved report", null, LocalDateTime.now().minusMinutes(2));
        resolved.resolve(admin.getId(), ReportResolution.IGNORE, "not confirmed", LocalDateTime.now().minusMinutes(1));
        reportRepository.saveAndFlush(resolved);
        reportRepository.saveAndFlush(Report.create(admin.getId(), ReportTargetType.USER, target.getId(),
                "pending report", null, LocalDateTime.now()));
        for (int i = 0; i < 11; i++) {
            saveAudit(target.getId(), admin.getId(), "ACTION_" + i);
        }
        saveAudit(admin.getId(), admin.getId(), "UNRELATED");

        AdminUserDetailResponse detail = adminUserService.detail(target.getId());
        String json = objectMapper.writeValueAsString(detail);

        assertThat(detail.studentCertificationStatus()).isEqualTo("APPROVED");
        assertThat(detail.realNameCertificationStatus()).isEqualTo("PENDING");
        assertThat(detail.publicDemandCount()).isEqualTo(1);
        assertThat(detail.publicServicePackageCount()).isEqualTo(1);
        assertThat(detail.publicMomentCount()).isEqualTo(1);
        assertThat(detail.totalReportCount()).isEqualTo(2);
        assertThat(detail.pendingReportCount()).isEqualTo(1);
        assertThat(detail.auditRecords()).hasSize(10)
                .allMatch(record -> record.targetId().equals(target.getId()));
        assertThat(json)
                .doesNotContain("241881010")
                .doesNotContain("never-return-this-password-hash")
                .doesNotContain("studentNo")
                .doesNotContain("passwordHash")
                .doesNotContain("studentNoCipher")
                .doesNotContain("idCard");
    }

    @Test
    void adminCanDisableAndEnableUserWithAuditRecords() {
        User admin = createAdminContext("241881011");
        User target = createUser("241881012", "status-target", "CUSTOMER", "ACTIVE");

        AdminUserDetailResponse disabled = adminUserService.changeStatus(
                target.getId(), "DISABLED", "  account abuse  ");
        AdminUserDetailResponse active = adminUserService.changeStatus(
                target.getId(), "ACTIVE", "  appeal accepted  ");

        assertThat(disabled.status()).isEqualTo("DISABLED");
        assertThat(active.status()).isEqualTo("ACTIVE");
        assertThat(userRepository.findById(target.getId()).orElseThrow().getStatus()).isEqualTo("ACTIVE");
        assertThat(auditRecordRepository.findAll())
                .extracting("auditType", "targetId", "adminId", "auditResult", "remark")
                .containsExactly(
                        tuple("USER", target.getId(), admin.getId(), "DISABLE", "account abuse"),
                        tuple("USER", target.getId(), admin.getId(), "ENABLE", "appeal accepted"));
    }

    @Test
    void statusChangeRequiresReasonAndRejectsNoop() {
        createAdminContext("241881013");
        User target = createUser("241881014", "noop-target", "CUSTOMER", "ACTIVE");

        assertThatThrownBy(() -> adminUserService.changeStatus(target.getId(), "DISABLED", "  "))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.VALIDATION_ERROR);
        assertThatThrownBy(() -> adminUserService.changeStatus(target.getId(), "ACTIVE", "no change"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.STATUS_CONFLICT);
        assertThat(auditRecordRepository.count()).isZero();
    }

    @Test
    void administratorCannotDisableSelf() {
        User admin = createAdminContext("241881015");

        assertThatThrownBy(() -> adminUserService.changeStatus(admin.getId(), "DISABLED", "self"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);
        assertThat(userRepository.findById(admin.getId()).orElseThrow().getStatus()).isEqualTo("ACTIVE");
        assertThat(auditRecordRepository.count()).isZero();
    }

    @Test
    void lastActiveAdministratorCannotBeDisabled() {
        User target = createUser("241881016", "last-admin", "ADMIN", "ACTIVE");
        UserContext.setUserId(999999L);
        UserContext.setAdmin(true);

        assertThatThrownBy(() -> adminUserService.changeStatus(target.getId(), "DISABLED", "rotation"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.STATUS_CONFLICT);
        assertThat(userRepository.findById(target.getId()).orElseThrow().getStatus()).isEqualTo("ACTIVE");
        assertThat(auditRecordRepository.count()).isZero();
    }

    @Test
    void oneOfMultipleActiveAdministratorsCanBeDisabledSafely() {
        User target = createUser("241881017", "direct-admin", "ADMIN", "ACTIVE");
        User bindingAdmin = createUser("241881018", "binding-admin", "PROVIDER", "ACTIVE");
        grantAdmin(bindingAdmin);
        UserContext.setUserId(999999L);
        UserContext.setAdmin(true);

        AdminUserDetailResponse response = adminUserService.changeStatus(
                target.getId(), "DISABLED", "administrator rotation");

        assertThat(response.status()).isEqualTo("DISABLED");
        assertThat(userRepository.findById(bindingAdmin.getId()).orElseThrow().getStatus()).isEqualTo("ACTIVE");
        assertThat(auditRecordRepository.count()).isEqualTo(1);
    }

    private User createAdminContext(String studentNo) {
        User admin = createUser(studentNo, "admin", "ADMIN", "ACTIVE");
        UserContext.setUserId(admin.getId());
        UserContext.setCurrentRole(com.action.camera.common.security.UserRole.ADMIN);
        UserContext.setAdmin(true);
        return admin;
    }

    private User createUser(String studentNo, String nickname, String role, String status) {
        User user = new User();
        user.setStudentNo(studentNo);
        user.setPasswordHash("test-password-hash");
        user.setNickname(nickname);
        user.setSchool("南京大学");
        user.setCurrentRole(role);
        user.setStatus(status);
        return userRepository.saveAndFlush(user);
    }

    private void grantAdmin(User user) {
        UserRoleBinding binding = new UserRoleBinding();
        binding.setUserId(user.getId());
        binding.setRole("ADMIN");
        userRoleBindingRepository.saveAndFlush(binding);
    }

    private void saveStudentCertification(Long userId) {
        StudentCertification certification = new StudentCertification();
        certification.setUserId(userId);
        certification.setRealNameMasked("张*");
        certification.setStudentNoCipher(new byte[]{1, 2, 3});
        certification.setStudentNoHash("secret-student-hash");
        certification.setUniversity("南京大学");
        certification.setStudentCardFileId(11L);
        certification.setStatus("APPROVED");
        studentCertificationRepository.saveAndFlush(certification);
    }

    private void saveRealNameCertification(Long userId) {
        RealNameCertification certification = new RealNameCertification();
        certification.setUserId(userId);
        certification.setRealNameMasked("李*");
        certification.setIdCardNoMasked("320***********1234");
        certification.setIdCardFrontFileId(12L);
        certification.setIdCardBackFileId(13L);
        certification.setStatus("PENDING");
        realNameCertificationRepository.saveAndFlush(certification);
    }

    private void saveDemand(Long userId) {
        LocalDateTime now = LocalDateTime.now();
        demandRepository.saveAndFlush(new Demand(
                userId, "PORTRAIT", List.of("natural"), LocalDate.now().plusDays(5),
                "AFTERNOON", "weekends", List.of("NEAR_1_MONTH"), "NJ", "campus",
                20000, 40000, "public demand", List.of(), now, now.plusDays(30)));
    }

    private void saveService(Long userId) {
        ServicePackage service = new ServicePackage();
        service.setProviderId(userId);
        service.setTitle("public service");
        service.setCityCode("NJ");
        service.setServiceArea("campus");
        service.setScene("PORTRAIT");
        service.setStyleTags(List.of("natural"));
        service.setImages(List.of("image"));
        service.setBasePriceCent(39900L);
        service.setDurationMinutes(120);
        service.setOriginalCount(30);
        service.setRefinedCount(9);
        service.setDeliveryDays(7);
        service.setAvailableDates(List.of(LocalDate.now().plusDays(5)));
        service.setPortfolioIds(List.of());
        service.setDescription("service description");
        service.setTimeDescription("weekends");
        service.setTimeTags(List.of("weekend"));
        service.setStatus(ServicePackageStatus.ONLINE);
        service.setIsAvailable(true);
        servicePackageRepository.saveAndFlush(service);
    }

    private void saveMoment(Long userId) {
        MomentPost moment = new MomentPost();
        moment.setAuthorId(userId);
        moment.setAuthorRole("PROVIDER");
        moment.setTitle("public moment");
        moment.setContent("moment content");
        moment.setStatus(MomentStatus.PUBLISHED);
        moment.replaceImages(List.of("image"));
        momentPostRepository.saveAndFlush(moment);
    }

    private void saveAudit(Long targetId, Long adminId, String action) {
        AuditRecord record = new AuditRecord();
        record.setAuditType("USER");
        record.setTargetId(targetId);
        record.setAdminId(adminId);
        record.setAuditResult(action);
        record.setRemark("reason " + action);
        auditRecordRepository.saveAndFlush(record);
    }

    private void assertForbidden(Runnable action) {
        assertThatThrownBy(action::run)
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);
    }
}
