package com.action.camera.review.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.repository.CreditRecordRepository;
import com.action.camera.review.dto.ReviewComplaintArbitrateRequest;
import com.action.camera.review.dto.ReviewComplaintCreateRequest;
import com.action.camera.review.dto.ReviewComplaintResponse;
import com.action.camera.review.dto.ReviewCreateRequest;
import com.action.camera.review.dto.ReviewResponse;
import com.action.camera.review.repository.ReviewComplaintRepository;
import com.action.camera.review.repository.ReviewRepository;
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
class ReviewComplaintServiceTest {

    private static final Long CUSTOMER_ID = 1001L;
    private static final Long PROVIDER_ID = 2001L;
    private static final Long OUTSIDER_ID = 3101L;
    private static final Long ADMIN_ID = 4101L;
    private static final Long COMPLETED_ORDER_ID = 8002L;
    private static final Long CONVERSATION_ID = 9102L;
    private static final Long QUOTE_ID = 7102L;

    @Autowired
    private ReviewService reviewService;

    @Autowired
    private ReviewComplaintService complaintService;

    @Autowired
    private ReviewRepository reviewRepository;

    @Autowired
    private ReviewComplaintRepository complaintRepository;

    @Autowired
    private CreditRecordRepository creditRecordRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        createComplaintTable();
        insertUser(CUSTOMER_ID, "complaint-customer", "CUSTOMER");
        insertUser(PROVIDER_ID, "complaint-provider", "CUSTOMER");
        insertUser(OUTSIDER_ID, "complaint-outsider", "CUSTOMER");
        insertUser(ADMIN_ID, "complaint-admin", "ADMIN");
        insertCompletedOrder();
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    void reviewedUserCanCreateComplaint() {
        ReviewResponse review = createCustomerReview(5);
        UserContext.setUserId(PROVIDER_ID);

        ReviewComplaintResponse response = complaintService.create(
                review.reviewId(),
                new ReviewComplaintCreateRequest("not true", "1,2")
        );

        assertThat(response.reviewId()).isEqualTo(review.reviewId());
        assertThat(response.complainantId()).isEqualTo(PROVIDER_ID);
        assertThat(response.respondentId()).isEqualTo(CUSTOMER_ID);
        assertThat(response.status()).isEqualTo("PENDING");
        assertThat(complaintRepository.findById(response.complaintId())).isPresent();
    }

    @Test
    void duplicatePendingComplaintIsRejected() {
        ReviewResponse review = createCustomerReview(5);
        UserContext.setUserId(PROVIDER_ID);
        complaintService.create(review.reviewId(), new ReviewComplaintCreateRequest("not true", null));

        assertThatThrownBy(() -> complaintService.create(review.reviewId(), new ReviewComplaintCreateRequest("again", null)))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.DUPLICATE_OPERATION);
    }

    @Test
    void onlyReviewedUserCanCreateComplaint() {
        ReviewResponse review = createCustomerReview(5);
        UserContext.setUserId(OUTSIDER_ID);

        assertThatThrownBy(() -> complaintService.create(review.reviewId(), new ReviewComplaintCreateRequest("not mine", null)))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    void adminCanHideReviewAndReverseCreditByArbitration() {
        ReviewResponse review = createCustomerReview(5);
        UserContext.setUserId(PROVIDER_ID);
        ReviewComplaintResponse complaint = complaintService.create(
                review.reviewId(),
                new ReviewComplaintCreateRequest("fake review", null)
        );

        UserContext.setUserId(ADMIN_ID);
        ReviewComplaintResponse resolved = complaintService.arbitrate(
                complaint.complaintId(),
                new ReviewComplaintArbitrateRequest("REVIEW_HIDDEN", "complaint accepted")
        );

        assertThat(resolved.status()).isEqualTo("RESOLVED");
        assertThat(resolved.arbitrationResult()).isEqualTo("REVIEW_HIDDEN");
        assertThat(reviewRepository.findById(review.reviewId())).get()
                .extracting("isVisible")
                .isEqualTo(false);
        assertThat(creditRecordRepository.findByUserIdOrderByCreatedAtDesc(PROVIDER_ID))
                .extracting("eventType", "scoreChange")
                .contains(
                        org.assertj.core.groups.Tuple.tuple("REVIEW", 2),
                        org.assertj.core.groups.Tuple.tuple("REVIEW_ARBITRATION", -2)
                );
    }

    @Test
    void nonAdminCannotArbitrate() {
        ReviewResponse review = createCustomerReview(5);
        UserContext.setUserId(PROVIDER_ID);
        ReviewComplaintResponse complaint = complaintService.create(
                review.reviewId(),
                new ReviewComplaintCreateRequest("fake review", null)
        );

        UserContext.setUserId(OUTSIDER_ID);
        assertThatThrownBy(() -> complaintService.arbitrate(
                complaint.complaintId(),
                new ReviewComplaintArbitrateRequest("REJECTED", "no issue")
        ))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    private ReviewResponse createCustomerReview(int rating) {
        UserContext.setUserId(CUSTOMER_ID);
        return reviewService.create(COMPLETED_ORDER_ID, new ReviewCreateRequest(rating, "test review"));
    }

    private void createComplaintTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS review_complaints (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    review_id BIGINT NOT NULL,
                    order_id BIGINT NOT NULL,
                    complainant_id BIGINT NOT NULL,
                    respondent_id BIGINT NOT NULL,
                    reason VARCHAR(1000) NOT NULL,
                    evidence_file_ids VARCHAR(500),
                    status VARCHAR(30) NOT NULL,
                    arbitration_result VARCHAR(30),
                    arbitration_comment VARCHAR(1000),
                    handled_by BIGINT,
                    created_at TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP NOT NULL,
                    handled_at TIMESTAMP
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

    private void insertCompletedOrder() {
        jdbcTemplate.update("""
                INSERT INTO conversations (id, participant_a_id, participant_b_id, source_type, created_at)
                VALUES (?, ?, ?, 'DIRECT', NOW())
                ON DUPLICATE KEY UPDATE participant_a_id = VALUES(participant_a_id)
                """, CONVERSATION_ID, CUSTOMER_ID, PROVIDER_ID);
        jdbcTemplate.update("""
                INSERT INTO quotes (
                    id, quote_no, conversation_id, provider_user_id, customer_id, source_type,
                    shoot_start_time, shoot_end_time, location, original_count, refined_count,
                    delivery_deadline, photo_usage_scope, service_snapshot_json, total_amount,
                    status, expire_time, created_at, updated_at
                )
                VALUES (
                    ?, 'QUOTE-COMPLAINT-TEST', ?, ?, ?, 'DIRECT',
                    NOW(), DATEADD('HOUR', 1, NOW()), 'test-location', 0, 1,
                    DATEADD('DAY', 1, NOW()), 'PERSONAL_ONLY', JSON_OBJECT(), 100.00,
                    'CONFIRMED', DATEADD('DAY', 1, NOW()), NOW(), NOW()
                )
                ON DUPLICATE KEY UPDATE conversation_id = VALUES(conversation_id)
                """, QUOTE_ID, CONVERSATION_ID, PROVIDER_ID, CUSTOMER_ID);
        jdbcTemplate.update("""
                INSERT INTO orders (
                    id, order_no, quote_id, conversation_id, customer_id, provider_user_id,
                    status, escrow_status, settlement_status, refund_status, total_amount,
                    platform_fee, provider_income, shoot_start_time, shoot_end_time, shoot_location,
                    delivery_deadline, photo_usage_scope, quote_snapshot_json, safety_notice_confirmed,
                    created_at, updated_at
                )
                VALUES (
                    ?, 'ORDER-COMPLAINT-TEST', ?, ?, ?, ?,
                    'COMPLETED', 'HELD', 'NOT_SETTLED', 'NONE', 100.00,
                    0.00, 100.00, NOW(), DATEADD('HOUR', 1, NOW()), 'test-location',
                    DATEADD('DAY', 1, NOW()), 'PERSONAL_ONLY', JSON_OBJECT(), FALSE,
                    NOW(), NOW()
                )
                ON DUPLICATE KEY UPDATE status = VALUES(status)
                """, COMPLETED_ORDER_ID, QUOTE_ID, CONVERSATION_ID, CUSTOMER_ID, PROVIDER_ID);
    }
}
