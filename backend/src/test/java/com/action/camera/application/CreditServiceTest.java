package com.action.camera.application;

import com.action.camera.domain.CreditRecord;
import com.action.camera.domain.User;
import com.action.camera.repository.CreditRecordRepository;
import com.action.camera.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class CreditServiceTest {

    private static final Long NEW_USER_ID = 710001L;
    private static final Long RATING_USER_ID = 710002L;
    private static final Long EXISTING_USER_ID = 710003L;
    private static final Long DEDUP_USER_ID = 710004L;

    @Autowired
    private CreditService creditService;

    @Autowired
    private CreditRecordRepository creditRecordRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        creditRecordRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void firstFiveStarEventUsesBaselineButKeepsBeforeScoreNull() {
        createUser(NEW_USER_ID, null);

        CreditRecord record = creditService.updateCreditScore(
                NEW_USER_ID,
                0,
                "REVIEW",
                9001L,
                "first review",
                "REVIEW",
                9001L
        );

        User user = userRepository.findById(NEW_USER_ID).orElseThrow();
        assertThat(user.getCreditScore()).isEqualByComparingTo("80.00");
        assertThat(record.getBeforeScore()).isNull();
        assertThat(record.getScoreAfter()).isEqualByComparingTo("80.00");
        assertThat(record.getAfterScore()).isEqualByComparingTo("80.00");
        assertThat(record.getAppliedScoreChange()).isZero();
    }

    @Test
    void firstFourStarEventUsesBaselineAndStoresNegativeChange() {
        createUser(RATING_USER_ID, null);

        CreditRecord record = creditService.updateCreditScore(
                RATING_USER_ID,
                -1,
                "REVIEW",
                9002L,
                "first review",
                "REVIEW",
                9002L
        );

        User user = userRepository.findById(RATING_USER_ID).orElseThrow();
        assertThat(user.getCreditScore()).isEqualByComparingTo("79.00");
        assertThat(record.getBeforeScore()).isNull();
        assertThat(record.getScoreAfter()).isEqualByComparingTo("79.00");
        assertThat(record.getAfterScore()).isEqualByComparingTo("79.00");
        assertThat(record.getAppliedScoreChange()).isEqualTo(-1);
    }

    @Test
    void existingScoreContinuesFromCurrentValue() {
        createUser(EXISTING_USER_ID, new BigDecimal("92.50"));

        CreditRecord record = creditService.updateCreditScore(
                EXISTING_USER_ID,
                -4,
                "REVIEW",
                9003L,
                "existing score",
                "REVIEW",
                9003L
        );

        User user = userRepository.findById(EXISTING_USER_ID).orElseThrow();
        assertThat(user.getCreditScore()).isEqualByComparingTo("88.50");
        assertThat(record.getBeforeScore()).isEqualByComparingTo("92.50");
        assertThat(record.getScoreAfter()).isEqualByComparingTo("88.50");
        assertThat(record.getAppliedScoreChange()).isEqualTo(-4);
    }

    @Test
    void duplicateSourceDoesNotCreateSecondCreditRecord() {
        createUser(DEDUP_USER_ID, null);

        CreditRecord first = creditService.updateCreditScore(
                DEDUP_USER_ID,
                0,
                "REVIEW",
                9004L,
                "dedup",
                "REVIEW",
                9004L
        );
        CreditRecord second = creditService.updateCreditScore(
                DEDUP_USER_ID,
                -1,
                "REVIEW",
                9004L,
                "dedup",
                "REVIEW",
                9004L
        );

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(userRepository.findById(DEDUP_USER_ID).orElseThrow().getCreditScore()).isEqualByComparingTo("80.00");
        assertThat(creditRecordRepository.findByUserIdOrderByCreatedAtDesc(DEDUP_USER_ID)).hasSize(1);
    }

    private void createUser(Long id, BigDecimal creditScore) {
        if (creditScore == null) {
            jdbcTemplate.update("""
                    INSERT INTO users (id, nickname, current_role, status, credit_score, created_at, updated_at)
                    VALUES (?, ?, 'CUSTOMER', 'ACTIVE', NULL, NOW(), NOW())
                    ON DUPLICATE KEY UPDATE nickname = VALUES(nickname), current_role = VALUES(current_role), status = VALUES(status), credit_score = VALUES(credit_score)
                    """, id, "user-" + id);
            return;
        }
        jdbcTemplate.update("""
                INSERT INTO users (id, nickname, current_role, status, credit_score, created_at, updated_at)
                VALUES (?, ?, 'CUSTOMER', 'ACTIVE', ?, NOW(), NOW())
                ON DUPLICATE KEY UPDATE nickname = VALUES(nickname), current_role = VALUES(current_role), status = VALUES(status), credit_score = VALUES(credit_score)
                """, id, "user-" + id, creditScore);
    }
}
