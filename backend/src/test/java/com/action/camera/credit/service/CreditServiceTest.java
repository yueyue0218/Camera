package com.action.camera.credit.service;

import com.action.camera.credit.dto.CreditRecordResponse;
import com.action.camera.credit.dto.CreditSummaryResponse;
import com.action.camera.credit.repository.CreditRecordRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class CreditServiceTest {

    private static final Long USER_ID = 920001L;

    @Autowired
    private CreditService creditService;

    @Autowired
    private CreditRecordRepository creditRecordRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        insertUser(USER_ID, "credit-user");
    }

    @Test
    void fiveStarReviewCreatesPositiveCreditRecord() {
        CreditRecordResponse response = creditService.createReviewCreditRecord(
                USER_ID,
                null,
                5,
                "5 星评价"
        );

        assertThat(response.userId()).isEqualTo(USER_ID);
        assertThat(response.relatedOrderId()).isNull();
        assertThat(response.eventType()).isEqualTo("REVIEW");
        assertThat(response.scoreChange()).isEqualTo(2);
        assertThat(response.scoreAfter()).isEqualByComparingTo(BigDecimal.valueOf(82));
        assertThat(response.createdAt()).isNotNull();
        assertThat(creditRecordRepository.findById(response.recordId())).isPresent();
    }

    @Test
    void oneStarReviewCreatesNegativeCreditRecord() {
        CreditRecordResponse response = creditService.createReviewCreditRecord(
                USER_ID,
                null,
                1,
                "1 星评价"
        );

        assertThat(response.scoreChange()).isEqualTo(-5);
        assertThat(response.scoreAfter()).isEqualByComparingTo(BigDecimal.valueOf(75));
    }

    @Test
    void creditScoreIsClampedToOneHundred() {
        for (int i = 0; i < 20; i++) {
            creditService.createReviewCreditRecord(USER_ID, null, 5, "连续好评");
        }

        CreditSummaryResponse summary = creditService.getCreditSummary(USER_ID);

        assertThat(summary.creditScore()).isEqualByComparingTo(BigDecimal.valueOf(100));
    }

    @Test
    void listRecordsReturnsUserRecords() {
        creditService.createReviewCreditRecord(USER_ID, null, 5, "好评");
        creditService.createReviewCreditRecord(USER_ID, null, 2, "差评");

        List<CreditRecordResponse> records = creditService.listRecords(USER_ID);

        assertThat(records).hasSize(2);
        assertThat(records)
                .extracting(CreditRecordResponse::userId)
                .containsOnly(USER_ID);
    }

    @Test
    void creditSummaryDefaultsToInitialScoreWithoutRecords() {
        CreditSummaryResponse summary = creditService.getCreditSummary(930001L);

        assertThat(summary.creditScore()).isEqualByComparingTo(BigDecimal.valueOf(80));
        assertThat(summary.recordCount()).isZero();
        assertThat(summary.lastUpdatedAt()).isNull();
    }

    private void insertUser(Long userId, String nickname) {
        jdbcTemplate.update("""
                INSERT INTO users (id, nickname, current_role, status)
                VALUES (?, ?, 'CUSTOMER', 'ACTIVE')
                ON DUPLICATE KEY UPDATE nickname = VALUES(nickname)
                """, userId, nickname);
    }
}
