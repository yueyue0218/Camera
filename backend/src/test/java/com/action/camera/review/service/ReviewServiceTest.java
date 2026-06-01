package com.action.camera.review.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.notification.repository.NotificationRepository;
import com.action.camera.repository.CreditRecordRepository;
import com.action.camera.review.dto.ReviewCreateRequest;
import com.action.camera.review.dto.ReviewResponse;
import com.action.camera.review.repository.ReviewRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Transactional
class ReviewServiceTest {

    private static final Long CUSTOMER_ID = 1001L;
    private static final Long PROVIDER_ID = 2001L;
    private static final Long OUTSIDER_ID = 3001L;
    private static final Long COMPLETED_ORDER_ID = 8002L;
    private static final Long PROVIDER_FAULT_REFUNDED_ORDER_ID = 8003L;
    private static final Long CUSTOMER_FAULT_REFUNDED_ORDER_ID = 8004L;
    private static final Long BOTH_FAULT_REFUNDED_ORDER_ID = 8005L;
    private static final Long MUTUAL_REFUNDED_ORDER_ID = 8006L;
    private static final Long UNDETERMINED_REFUNDED_ORDER_ID = 8007L;
    private static final Long CONVERSATION_ID = 9002L;
    private static final Long QUOTE_ID = 7002L;

    @Autowired
    private ReviewService reviewService;

    @Autowired
    private ReviewRepository reviewRepository;

    @Autowired
    private CreditRecordRepository creditRecordRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        insertUser(CUSTOMER_ID, "review-customer");
        insertUser(PROVIDER_ID, "review-provider");
        insertUser(OUTSIDER_ID, "review-outsider");
        insertCompletedOrder();
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    void customerCanCreateReviewForCompletedOrder() {
        UserContext.setUserId(CUSTOMER_ID);

        ReviewResponse response = reviewService.create(
                COMPLETED_ORDER_ID,
                new ReviewCreateRequest(5, "服务很好")
        );

        assertThat(response.orderId()).isEqualTo(COMPLETED_ORDER_ID);
        assertThat(response.reviewerId()).isEqualTo(CUSTOMER_ID);
        assertThat(response.targetUserId()).isEqualTo(PROVIDER_ID);
        assertThat(response.direction()).isEqualTo("CUSTOMER_TO_PROVIDER");
        assertThat(response.rating()).isEqualTo(5);
        assertThat(response.isVisible()).isTrue();
        assertThat(reviewRepository.findById(response.reviewId())).isPresent();
    }

    @Test
    void createReviewGeneratesCreditRecordAndNotification() {
        UserContext.setUserId(CUSTOMER_ID);

        reviewService.create(COMPLETED_ORDER_ID, new ReviewCreateRequest(5, "服务很好"));

        assertThat(creditRecordRepository.findByUserIdOrderByCreatedAtDesc(PROVIDER_ID))
                .hasSize(1)
                .first()
                .satisfies(record -> {
                    assertThat(record.getRelatedOrderId()).isEqualTo(COMPLETED_ORDER_ID);
                    assertThat(record.getEventType()).isEqualTo("REVIEW");
                    assertThat(record.getScoreChange()).isEqualTo(2);
                });
        assertThat(notificationRepository.findByUserIdOrderByCreatedAtDesc(PROVIDER_ID))
                .hasSize(1)
                .first()
                .satisfies(notification -> {
                    assertThat(notification.getType()).isEqualTo("REVIEW_RECEIVED");
                    assertThat(notification.getRelatedType()).isEqualTo("ORDER");
                    assertThat(notification.getRelatedId()).isEqualTo(COMPLETED_ORDER_ID);
                    assertThat(notification.getIsRead()).isFalse();
                });
    }

    @Test
    void duplicateReviewDirectionIsRejected() {
        UserContext.setUserId(CUSTOMER_ID);
        reviewService.create(COMPLETED_ORDER_ID, new ReviewCreateRequest(5, "第一次评价"));

        assertThatThrownBy(() -> reviewService.create(COMPLETED_ORDER_ID, new ReviewCreateRequest(4, "重复评价")))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.DUPLICATE_OPERATION);
        assertThat(creditRecordRepository.findByUserIdOrderByCreatedAtDesc(PROVIDER_ID)).hasSize(1);
        assertThat(notificationRepository.findByUserIdOrderByCreatedAtDesc(PROVIDER_ID)).hasSize(1);
    }

    @Test
    void nonParticipantCannotCreateReview() {
        UserContext.setUserId(OUTSIDER_ID);

        assertThatThrownBy(() -> reviewService.create(COMPLETED_ORDER_ID, new ReviewCreateRequest(5, "无关评价")))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    void pendingDeliveryOrderCannotBeReviewed() {
        UserContext.setUserId(PROVIDER_ID);

        assertThatThrownBy(() -> reviewService.create(8001L, new ReviewCreateRequest(5, "提前评价")))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.STATUS_CONFLICT);
    }

    @Test
    void customerCanReviewProviderFaultRefundAndCreditIsDeducted() {
        UserContext.setUserId(CUSTOMER_ID);

        ReviewResponse response = reviewService.create(
                PROVIDER_FAULT_REFUNDED_ORDER_ID,
                new ReviewCreateRequest(1, "Provider broke the refund responsibility")
        );

        assertThat(response.targetUserId()).isEqualTo(PROVIDER_ID);
        assertThat(response.direction()).isEqualTo("CUSTOMER_TO_PROVIDER");
        assertThat(response.rating()).isEqualTo(1);
        assertThat(creditRecordRepository.findByUserIdOrderByCreatedAtDesc(PROVIDER_ID))
                .hasSize(1)
                .first()
                .satisfies(record -> {
                    assertThat(record.getRelatedOrderId()).isEqualTo(PROVIDER_FAULT_REFUNDED_ORDER_ID);
                    assertThat(record.getEventType()).isEqualTo("REVIEW");
                    assertThat(record.getScoreChange()).isEqualTo(-5);
                });
    }

    @Test
    void providerCanReviewCustomerFaultRefundAndCreditIsDeducted() {
        UserContext.setUserId(PROVIDER_ID);

        ReviewResponse response = reviewService.create(
                CUSTOMER_FAULT_REFUNDED_ORDER_ID,
                new ReviewCreateRequest(2, "Customer broke the refund responsibility")
        );

        assertThat(response.targetUserId()).isEqualTo(CUSTOMER_ID);
        assertThat(response.direction()).isEqualTo("PROVIDER_TO_CUSTOMER");
        assertThat(creditRecordRepository.findByUserIdOrderByCreatedAtDesc(CUSTOMER_ID))
                .hasSize(1)
                .first()
                .satisfies(record -> {
                    assertThat(record.getRelatedOrderId()).isEqualTo(CUSTOMER_FAULT_REFUNDED_ORDER_ID);
                    assertThat(record.getEventType()).isEqualTo("REVIEW");
                    assertThat(record.getScoreChange()).isEqualTo(-2);
                });
    }

    @Test
    void bothFaultRefundAllowsBothDirections() {
        UserContext.setUserId(CUSTOMER_ID);
        reviewService.create(BOTH_FAULT_REFUNDED_ORDER_ID, new ReviewCreateRequest(2, "Provider also at fault"));

        UserContext.setUserId(PROVIDER_ID);
        reviewService.create(BOTH_FAULT_REFUNDED_ORDER_ID, new ReviewCreateRequest(2, "Customer also at fault"));

        assertThat(reviewRepository.findByOrderIdOrderByCreatedAtDesc(BOTH_FAULT_REFUNDED_ORDER_ID))
                .extracting("direction")
                .containsExactlyInAnyOrder("CUSTOMER_TO_PROVIDER", "PROVIDER_TO_CUSTOMER");
        assertThat(creditRecordRepository.findByUserIdOrderByCreatedAtDesc(PROVIDER_ID))
                .extracting("scoreChange")
                .containsExactly(-2);
        assertThat(creditRecordRepository.findByUserIdOrderByCreatedAtDesc(CUSTOMER_ID))
                .extracting("scoreChange")
                .containsExactly(-2);
    }

    @Test
    void mutualOrUndeterminedRefundCannotBeReviewed() {
        UserContext.setUserId(CUSTOMER_ID);

        assertThatThrownBy(() -> reviewService.create(MUTUAL_REFUNDED_ORDER_ID, new ReviewCreateRequest(1, "Mutual refund")))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.STATUS_CONFLICT);
        assertThatThrownBy(() -> reviewService.create(UNDETERMINED_REFUNDED_ORDER_ID, new ReviewCreateRequest(1, "Unknown fault")))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.STATUS_CONFLICT);
    }

    @Test
    void faultPartyCannotReviewNonFaultPartyForRefund() {
        UserContext.setUserId(PROVIDER_ID);

        assertThatThrownBy(() -> reviewService.create(PROVIDER_FAULT_REFUNDED_ORDER_ID, new ReviewCreateRequest(1, "Counter review")))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    void listByOrderRequiresParticipant() {
        UserContext.setUserId(CUSTOMER_ID);
        reviewService.create(COMPLETED_ORDER_ID, new ReviewCreateRequest(5, "服务很好"));

        UserContext.setUserId(OUTSIDER_ID);
        assertThatThrownBy(() -> reviewService.listByOrder(COMPLETED_ORDER_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    void listReceivedByUserReturnsTargetReviews() {
        UserContext.setUserId(CUSTOMER_ID);
        reviewService.create(COMPLETED_ORDER_ID, new ReviewCreateRequest(5, "服务很好"));

        List<ReviewResponse> responses = reviewService.listReceivedByUser(PROVIDER_ID);

        assertThat(responses)
                .extracting(ReviewResponse::targetUserId)
                .containsExactly(PROVIDER_ID);
    }

    private void insertUser(Long userId, String nickname) {
        jdbcTemplate.update("""
                INSERT INTO users (id, nickname, current_role, status, credit_score, created_at, updated_at)
                VALUES (?, ?, 'CUSTOMER', 'ACTIVE', 80.00, NOW(), NOW())
                ON DUPLICATE KEY UPDATE nickname = VALUES(nickname)
                """, userId, nickname);
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
                    ?, 'QUOTE-D2-TEST', ?, ?, ?, 'DIRECT',
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
                    ?, 'ORDER-D2-TEST', ?, ?, ?, ?,
                    'COMPLETED', 'HELD', 'NOT_SETTLED', 'NONE', 100.00,
                    0.00, 100.00, NOW(), DATEADD('HOUR', 1, NOW()), 'test-location',
                    DATEADD('DAY', 1, NOW()), 'PERSONAL_ONLY', JSON_OBJECT(), FALSE,
                    NOW(), NOW()
                )
                ON DUPLICATE KEY UPDATE status = VALUES(status)
                """, COMPLETED_ORDER_ID, QUOTE_ID, CONVERSATION_ID, CUSTOMER_ID, PROVIDER_ID);
    }
}
