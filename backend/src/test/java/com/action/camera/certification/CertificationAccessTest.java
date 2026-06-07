package com.action.camera.certification;

import com.action.camera.certification.dto.CertificationRequest;
import com.action.camera.certification.dto.CertificationResponse;
import com.action.camera.certification.service.CertificationService;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.provider.dto.ProviderProfileUpdateDTO;
import com.action.camera.provider.service.ProviderProfileService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Transactional
class CertificationAccessTest {

    private static final Long CUSTOMER_ID = 1001L;
    private static final Long PROVIDER_ID = 2001L;
    private static final Long ADMIN_ID    = 4001L;

    @Autowired
    private CertificationService certificationService;

    @Autowired
    private ProviderProfileService providerProfileService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        createMyBatisPlusTables();
        insertUser(CUSTOMER_ID, "cert-customer", "CUSTOMER");
        insertUser(PROVIDER_ID, "cert-provider", "PROVIDER");
        insertUser(ADMIN_ID,    "cert-admin",    "ADMIN");
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    /**
     * CUSTOMER 角色（非 PROVIDER）调用 updateProfile，
     * 因角色检查先于档案存在性检查，应得到 FORBIDDEN。
     */
    @Test
    void unapprovedUserCannotUpdateProviderProfileWithoutProviderProfile() {
        ProviderProfileUpdateDTO dto = new ProviderProfileUpdateDTO();
        dto.setBio("test bio");

        assertThatThrownBy(() -> providerProfileService.updateProfile(CUSTOMER_ID, dto))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    /**
     * 首次提交认证申请后，状态应为 PENDING。
     */
    @Test
    void submitCertificationResultsInPendingStatus() {
        CertificationResponse response = certificationService.submit(CUSTOMER_ID, certRequest());

        assertThat(response.getStatus()).isEqualTo("PENDING");
        assertThat(response.getUserId()).isEqualTo(CUSTOMER_ID);
        assertThat(response.getRealName()).isEqualTo("张三");
        assertThat(response.getId()).isNotNull();
    }

    /**
     * 已有 PENDING 申请时再次提交应抛出 CERT_PENDING。
     */
    @Test
    void resubmitWhilePendingThrowsCertPendingError() {
        certificationService.submit(CUSTOMER_ID, certRequest());

        assertThatThrownBy(() -> certificationService.submit(CUSTOMER_ID, certRequest()))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.CERT_PENDING);
    }

    /**
     * 管理员审批通过后，用户再次提交应抛出 CERT_APPROVED。
     */
    @Test
    void resubmitAfterApprovalThrowsCertApprovedError() {
        CertificationResponse cert = certificationService.submit(CUSTOMER_ID, certRequest());
        certificationService.approve(ADMIN_ID, cert.getId());

        assertThatThrownBy(() -> certificationService.submit(CUSTOMER_ID, certRequest()))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.CERT_APPROVED);
    }

    /**
     * 管理员拒绝后，用户可以重新提交，状态重置为 PENDING。
     */
    @Test
    void resubmitAfterRejectionSucceedsWithPendingStatus() {
        CertificationResponse cert = certificationService.submit(CUSTOMER_ID, certRequest());
        certificationService.reject(ADMIN_ID, cert.getId(), "身份证照片模糊");

        CertificationResponse resubmitted = certificationService.submit(CUSTOMER_ID, certRequest());

        assertThat(resubmitted.getStatus()).isEqualTo("PENDING");
        assertThat(resubmitted.getUserId()).isEqualTo(CUSTOMER_ID);
        assertThat(resubmitted.getId()).isNotEqualTo(cert.getId());
    }

    // ---- helpers ----

    private CertificationRequest certRequest() {
        CertificationRequest req = new CertificationRequest();
        req.setRealName("张三");
        req.setIdCardNumber("310101200001011234");
        req.setIdCardFrontFileId(1L);
        req.setIdCardBackFileId(2L);
        return req;
    }

    private void createMyBatisPlusTables() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS real_name_certifications (
                    id                   BIGINT AUTO_INCREMENT PRIMARY KEY,
                    user_id              BIGINT NOT NULL,
                    real_name            VARCHAR(50),
                    id_card_number       VARCHAR(100),
                    id_card_front_file_id BIGINT,
                    id_card_back_file_id  BIGINT,
                    status               VARCHAR(20),
                    reject_reason        VARCHAR(500),
                    created_at           TIMESTAMP,
                    reviewed_at          TIMESTAMP,
                    reviewer_admin_id    BIGINT
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS audit_records (
                    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
                    target_type VARCHAR(50),
                    target_id   BIGINT,
                    admin_id    BIGINT,
                    action      VARCHAR(20),
                    reason      VARCHAR(500),
                    created_at  TIMESTAMP
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS provider_profiles (
                    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
                    user_id          BIGINT NOT NULL,
                    service_type     VARCHAR(50),
                    display_name     VARCHAR(64),
                    bio              VARCHAR(500),
                    city_code        VARCHAR(32),
                    city_area        VARCHAR(64),
                    price_min        DECIMAL(10,2),
                    price_max        DECIMAL(10,2),
                    accepting_orders BOOLEAN,
                    avg_rating       DECIMAL(3,2),
                    completed_orders INT,
                    audit_status     VARCHAR(20),
                    age              INT,
                    equipment        VARCHAR(500),
                    created_at       TIMESTAMP,
                    updated_at       TIMESTAMP
                )
                """);
    }

    private void insertUser(Long userId, String nickname, String currentRole) {
        jdbcTemplate.update("""
                INSERT INTO users (id, nickname, current_role, status, credit_score, created_at, updated_at)
                VALUES (?, ?, ?, 'ACTIVE', 80.00, NOW(), NOW())
                ON DUPLICATE KEY UPDATE nickname = VALUES(nickname), current_role = VALUES(current_role)
                """, userId, nickname, currentRole);
    }
}
