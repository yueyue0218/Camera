package com.action.camera.credit.controller;

import com.action.camera.application.CreditService;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.security.UserRole;
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
class CreditControllerTest {

    private static final Long USER_ID = 940001L;
    private static final Long OTHER_USER_ID = 940002L;
    private static final Long ADMIN_ID = 940003L;

    @Autowired
    private CreditController creditController;

    @Autowired
    private CreditService creditService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        insertUser(USER_ID, "credit-user", "CUSTOMER");
        insertUser(OTHER_USER_ID, "credit-other", "CUSTOMER");
        insertUser(ADMIN_ID, "credit-admin", "ADMIN");
        creditService.updateCreditScore(USER_ID, 2, "TEST", 1L, "test credit", "TEST", 100L);
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    void creditSummaryIsReadableForAnyLoggedUser() {
        UserContext.setUserId(OTHER_USER_ID);
        UserContext.setCurrentRole(UserRole.CUSTOMER);

        var summary = creditController.getCreditSummary(USER_ID).getData();

        assertThat(summary.userId()).isEqualTo(USER_ID);
        assertThat(summary.creditScore()).isNull();
        assertThat(summary.creditLevel()).isEqualTo("新用户");
        assertThat(summary.effectiveOrderCount()).isZero();
    }

    @Test
    void creditRecordsRequireSelfOrAdmin() {
        UserContext.setUserId(OTHER_USER_ID);
        UserContext.setCurrentRole(UserRole.CUSTOMER);

        assertThatThrownBy(() -> creditController.listCreditRecords(USER_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);

        UserContext.setUserId(USER_ID);
        assertThat(creditController.listCreditRecords(USER_ID).getData()).hasSize(1);

        UserContext.setUserId(ADMIN_ID);
        UserContext.setCurrentRole(UserRole.ADMIN);
        assertThat(creditController.listCreditRecords(USER_ID).getData()).hasSize(1);
    }

    private void insertUser(Long userId, String nickname, String currentRole) {
        jdbcTemplate.update("""
                INSERT INTO users (id, nickname, current_role, status, credit_score, created_at, updated_at)
                VALUES (?, ?, ?, 'ACTIVE', 80.00, NOW(), NOW())
                ON DUPLICATE KEY UPDATE nickname = VALUES(nickname), current_role = VALUES(current_role)
                """, userId, nickname, currentRole);
    }
}
