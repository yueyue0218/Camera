package com.action.camera.credit;

import com.action.camera.credit.repository.CreditReviewAggregate;
import com.action.camera.credit.repository.UserCountAggregate;
import com.action.camera.credit.service.CreditSnapshotService;
import com.action.camera.dispute.repository.DisputeRepository;
import com.action.camera.order.repository.OrderRepository;
import com.action.camera.review.repository.ReviewComplaintRepository;
import com.action.camera.review.repository.ReviewRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest(properties = "spring.jpa.defer-datasource-initialization=true")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class CreditSnapshotBatchIntegrationTest {

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private ReviewRepository reviewRepository;

    @Autowired
    private ReviewComplaintRepository reviewComplaintRepository;

    @Autowired
    private DisputeRepository disputeRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void aggregateQueriesProduceTheSameCreditInputsAcrossAllSources() {
        insertCompletedOrder(1001L, 31L, 21L);
        insertCompletedOrder(1002L, 32L, 21L);
        insertVisibleReview(2001L, 1001L, 31L, 21L, "CUSTOMER_TO_PROVIDER", 5);
        insertVisibleReview(2002L, 1002L, 32L, 21L, "CUSTOMER_TO_PROVIDER", 4);
        jdbcTemplate.update("""
                insert into review_complaints
                    (id, review_id, order_id, complainant_id, respondent_id, status,
                     arbitration_result, created_at, updated_at)
                values (?, ?, ?, ?, ?, 'RESOLVED', 'REVIEW_HIDDEN', current_timestamp, current_timestamp)
                """, 3001L, 2001L, 1001L, 31L, 21L);
        jdbcTemplate.update("""
                insert into disputes
                    (id, order_id, initiator_id, previous_order_status, reason, status,
                     responsibility, created_at, updated_at)
                values (?, ?, ?, 'COMPLETED', 'quality', 'RESOLVED',
                        'PROVIDER_FAULT', current_timestamp, current_timestamp)
                """, 4001L, 1002L, 32L);

        CreditSnapshotService service = new CreditSnapshotService(
                orderRepository, reviewRepository, reviewComplaintRepository, disputeRepository);
        CreditSnapshotService.CreditSnapshot snapshot = service.getSnapshots(List.of(21L)).get(21L);

        assertThat(snapshot).isEqualTo(new CreditSnapshotService.CreditSnapshot(
                new BigDecimal("63.7"),
                2L,
                2L,
                new BigDecimal("100.0"),
                new BigDecimal("100.0"),
                2L,
                2L,
                new BigDecimal("4.5")
        ));
    }

    @Test
    void batchSnapshotsMatchLegacySingleSnapshotsForEveryDataAndRiskShape() {
        insertCompletedOrder(5101L, 151L, 51L);
        insertCompletedOrder(5102L, 152L, 51L);
        insertVisibleReview(5201L, 5101L, 151L, 51L, "CUSTOMER_TO_PROVIDER", 5);
        insertVisibleReview(5202L, 5102L, 152L, 51L, "CUSTOMER_TO_PROVIDER", 3);

        insertCompletedOrder(5301L, 153L, 53L);
        insertVisibleReview(5401L, 5301L, 153L, 53L, "CUSTOMER_TO_PROVIDER", 5);

        insertCompletedOrder(5501L, 154L, 54L);
        insertVisibleReview(5601L, 5501L, 154L, 54L, "CUSTOMER_TO_PROVIDER", 4);
        insertResponsibleComplaint(5701L, 5601L, 5501L, 154L, 54L);

        insertCompletedOrder(5801L, 155L, 55L);
        insertVisibleReview(5901L, 5801L, 155L, 55L, "CUSTOMER_TO_PROVIDER", 2);
        insertResponsibleDispute(6001L, 5801L, 155L);

        List<Long> userIds = List.of(51L, 52L, 53L, 54L, 55L, 56L);
        CreditSnapshotService service = new CreditSnapshotService(
                orderRepository, reviewRepository, reviewComplaintRepository, disputeRepository);
        var batch = service.getSnapshots(userIds);
        List<CreditReviewAggregate> reviewAggregates = reviewRepository.findCreditAggregates(userIds);
        List<UserCountAggregate> complaintAggregates = reviewComplaintRepository.findResponsibleComplaintCounts(
                userIds, "RESOLVED", "REVIEW_HIDDEN");
        List<UserCountAggregate> disputeAggregates = disputeRepository.findResponsibleResolvedDisputeCounts(userIds);

        for (Long userId : userIds) {
            assertThat(batch.get(userId))
                    .as("batch snapshot for user %s", userId)
                    .isEqualTo(service.getSnapshot(userId));

            long legacyPositiveCount = reviewRepository
                    .findByTargetUserIdAndIsVisibleTrueOrderByCreatedAtDesc(userId).stream()
                    .filter(review -> review.getRating() != null && review.getRating() >= 4)
                    .count();
            long batchPositiveCount = reviewAggregates.stream()
                    .filter(aggregate -> Objects.equals(aggregate.getUserId(), userId))
                    .map(CreditReviewAggregate::getGoodReviewCount)
                    .filter(Objects::nonNull)
                    .findFirst()
                    .orElse(0L);
            assertThat(batchPositiveCount).as("positive count for user %s", userId)
                    .isEqualTo(legacyPositiveCount);

            long legacyComplaintCount = reviewComplaintRepository
                    .countByRespondentIdAndStatusAndArbitrationResult(userId, "RESOLVED", "REVIEW_HIDDEN");
            assertThat(aggregateCount(complaintAggregates, userId))
                    .as("responsible complaint count for user %s", userId)
                    .isEqualTo(legacyComplaintCount);

            long legacyDisputeCount = disputeRepository.countResponsibleResolvedDisputesForUser(userId);
            assertThat(aggregateCount(disputeAggregates, userId))
                    .as("responsible dispute count for user %s", userId)
                    .isEqualTo(legacyDisputeCount);
        }
    }

    private long aggregateCount(List<UserCountAggregate> aggregates, Long userId) {
        return aggregates.stream()
                .filter(aggregate -> Objects.equals(aggregate.getUserId(), userId))
                .map(UserCountAggregate::getAggregateCount)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(0L);
    }

    private void insertResponsibleComplaint(Long complaintId,
                                            Long reviewId,
                                            Long orderId,
                                            Long complainantId,
                                            Long respondentId) {
        jdbcTemplate.update("""
                insert into review_complaints
                    (id, review_id, order_id, complainant_id, respondent_id, status,
                     arbitration_result, created_at, updated_at)
                values (?, ?, ?, ?, ?, 'RESOLVED', 'REVIEW_HIDDEN', current_timestamp, current_timestamp)
                """, complaintId, reviewId, orderId, complainantId, respondentId);
    }

    private void insertResponsibleDispute(Long disputeId, Long orderId, Long initiatorId) {
        jdbcTemplate.update("""
                insert into disputes
                    (id, order_id, initiator_id, previous_order_status, reason, status,
                     responsibility, created_at, updated_at)
                values (?, ?, ?, 'COMPLETED', 'quality', 'RESOLVED',
                        'PROVIDER_FAULT', current_timestamp, current_timestamp)
                """, disputeId, orderId, initiatorId);
    }

    private void insertCompletedOrder(Long orderId, Long customerId, Long providerId) {
        jdbcTemplate.update("""
                insert into orders
                    (id, order_no, quote_id, conversation_id, customer_id, provider_user_id,
                     status, escrow_status, settlement_status, refund_status,
                     total_amount, platform_fee, provider_income,
                     shoot_start_time, shoot_end_time, shoot_location, delivery_deadline,
                     photo_usage_scope, quote_snapshot_json, safety_notice_confirmed,
                     created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, 'COMPLETED', 'RELEASED', 'SETTLED', 'NONE',
                        100.00, 0.00, 100.00,
                        current_timestamp, current_timestamp, 'NJ', current_timestamp,
                        'PERSONAL_ONLY', '{}', true, current_timestamp, current_timestamp)
                """, orderId, "O-" + orderId, orderId, orderId, customerId, providerId);
    }

    private void insertVisibleReview(Long reviewId,
                                     Long orderId,
                                     Long reviewerId,
                                     Long targetUserId,
                                     String direction,
                                     int rating) {
        jdbcTemplate.update("""
                insert into reviews
                    (id, order_id, reviewer_id, target_user_id, direction, rating, is_visible, created_at)
                values (?, ?, ?, ?, ?, ?, true, current_timestamp)
                """, reviewId, orderId, reviewerId, targetUserId, direction, rating);
    }
}
