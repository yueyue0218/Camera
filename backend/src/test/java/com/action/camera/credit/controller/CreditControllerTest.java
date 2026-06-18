package com.action.camera.credit.controller;

import com.action.camera.application.CreditService;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.security.UserRole;
import com.action.camera.dispute.entity.Dispute;
import com.action.camera.dispute.repository.DisputeRepository;
import com.action.camera.order.entity.Order;
import com.action.camera.order.enums.EscrowStatus;
import com.action.camera.order.enums.OrderStatus;
import com.action.camera.order.repository.OrderRepository;
import com.action.camera.repository.CreditRecordRepository;
import com.action.camera.review.entity.Review;
import com.action.camera.review.entity.ReviewComplaint;
import com.action.camera.review.repository.ReviewComplaintRepository;
import com.action.camera.review.repository.ReviewRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

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
    private CreditRecordRepository creditRecordRepository;

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

    @BeforeEach
    void setUp() {
        insertUser(USER_ID, "credit-user", "PROVIDER");
        insertUser(OTHER_USER_ID, "credit-other", "CUSTOMER");
        insertUser(ADMIN_ID, "credit-admin", "ADMIN");
        UserContext.clear();
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
        assertThat(summary.recordCount()).isZero();
        assertThat(summary.lastUpdatedAt()).isNull();
    }

    @Test
    void newUserHasNoCreditRecords() {
        UserContext.setUserId(USER_ID);
        UserContext.setCurrentRole(UserRole.PROVIDER);

        assertThat(creditController.listCreditRecords(USER_ID).getData()).isEmpty();
        assertThat(creditRecordRepository.findByUserIdOrderByCreatedAtDesc(USER_ID)).isEmpty();
    }

    @Test
    void creditRecordsRequireSelfOrAdmin() {
        creditService.updateCreditScore(USER_ID, 2, "TEST", 1L, "test credit", "TEST", 100L);

        UserContext.setUserId(OTHER_USER_ID);
        UserContext.setCurrentRole(UserRole.CUSTOMER);

        assertThatThrownBy(() -> creditController.listCreditRecords(USER_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);

        UserContext.setUserId(USER_ID);
        UserContext.setCurrentRole(UserRole.PROVIDER);
        assertThat(creditController.listCreditRecords(USER_ID).getData()).hasSize(1);

        UserContext.setUserId(ADMIN_ID);
        UserContext.setCurrentRole(UserRole.ADMIN);
        UserContext.setAdmin(true);
        assertThat(creditController.listCreditRecords(USER_ID).getData()).hasSize(1);
    }

    @Test
    void creditSummaryUsesReviewedOrdersAndResponsibleComplaintsAsRiskBasis() {
        Order completedOrder = saveOrder(970001L, OTHER_USER_ID, USER_ID, OrderStatus.COMPLETED, EscrowStatus.RELEASED, "NONE");
        Order refundedOrder = saveOrder(970002L, OTHER_USER_ID, USER_ID, OrderStatus.REFUNDED, EscrowStatus.REFUNDED, "PROVIDER_FAULT");

        saveReview(completedOrder.getId(), OTHER_USER_ID, USER_ID, "TO_PROVIDER", 5, true, LocalDateTime.now().minusDays(2));
        Review lowScoreReview = saveReview(refundedOrder.getId(), OTHER_USER_ID, USER_ID, "TO_PROVIDER", 2, true, LocalDateTime.now().minusDays(1));
        saveResolvedComplaint(lowScoreReview.getId(), refundedOrder.getId(), OTHER_USER_ID, USER_ID);

        UserContext.setUserId(OTHER_USER_ID);
        UserContext.setCurrentRole(UserRole.CUSTOMER);

        var summary = creditController.getCreditSummary(USER_ID).getData();

        assertThat(summary.effectiveOrderCount()).isEqualTo(2);
        assertThat(summary.completedOrderCount()).isEqualTo(1);
        assertThat(summary.receivedReviewCount()).isEqualTo(2);
        assertThat(summary.goodReviewRate()).isEqualByComparingTo("50.0");
        assertThat(summary.riskRecordCount()).isEqualTo(1);
        assertThat(summary.defaultRate()).isEqualByComparingTo("50.0");
        assertThat(summary.averageRating()).isEqualByComparingTo("3.5");
        assertThat(summary.creditScore()).isEqualByComparingTo("64.6");
        assertThat(summary.creditLevel()).isEqualTo("待积累");
    }

    @Test
    void creditSummaryCountsResolvedResponsibleDisputesAsRiskRecords() {
        Order completedOrder = saveOrder(970003L, OTHER_USER_ID, USER_ID, OrderStatus.COMPLETED, EscrowStatus.RELEASED, "NONE");
        saveReview(completedOrder.getId(), OTHER_USER_ID, USER_ID, "TO_PROVIDER", 4, true, LocalDateTime.now().minusHours(6));
        saveResolvedDispute(completedOrder.getId(), OTHER_USER_ID, OrderStatus.COMPLETED, "PROVIDER_FAULT");

        UserContext.setUserId(OTHER_USER_ID);
        UserContext.setCurrentRole(UserRole.CUSTOMER);

        var summary = creditController.getCreditSummary(USER_ID).getData();

        assertThat(summary.effectiveOrderCount()).isEqualTo(1);
        assertThat(summary.completedOrderCount()).isEqualTo(1);
        assertThat(summary.riskRecordCount()).isEqualTo(1);
        assertThat(summary.defaultRate()).isEqualByComparingTo("100.0");
    }

    private void insertUser(Long userId, String nickname, String currentRole) {
        jdbcTemplate.update("""
                INSERT INTO users (id, nickname, current_role, status, credit_score, created_at, updated_at)
                VALUES (?, ?, ?, 'ACTIVE', NULL, NOW(), NOW())
                ON DUPLICATE KEY UPDATE nickname = VALUES(nickname), current_role = VALUES(current_role), credit_score = VALUES(credit_score)
                """, userId, nickname, currentRole);
    }

    private Order saveOrder(Long quoteId,
                            Long customerId,
                            Long providerUserId,
                            OrderStatus status,
                            EscrowStatus escrowStatus,
                            String refundStatus) {
        LocalDateTime now = LocalDateTime.now();
        Order order = new Order();
        order.setOrderNo("TEST-" + quoteId);
        order.setQuoteId(quoteId);
        order.setConversationId(quoteId + 1000);
        order.setCustomerId(customerId);
        order.setProviderUserId(providerUserId);
        order.setStatus(status);
        order.setEscrowStatus(escrowStatus);
        order.setRefundStatus(refundStatus);
        order.setTotalAmountCent(10000L);
        order.setPlatformFeeCent(1000L);
        order.setProviderIncomeCent(9000L);
        order.setShootStartTime(now.minusDays(3));
        order.setShootEndTime(now.minusDays(3).plusHours(2));
        order.setShootLocation("Test campus");
        order.setDeliveryDeadline(now.minusDays(1));
        order.setQuoteSnapshotJson("{}");
        order.setSafetyNoticeConfirmed(true);
        return orderRepository.saveAndFlush(order);
    }

    private Review saveReview(Long orderId,
                              Long reviewerId,
                              Long targetUserId,
                              String direction,
                              int rating,
                              boolean visible,
                              LocalDateTime createdAt) {
        Review review = new Review();
        review.setOrderId(orderId);
        review.setReviewerId(reviewerId);
        review.setTargetUserId(targetUserId);
        review.setDirection(direction);
        review.setRating(rating);
        review.setContent("test review");
        review.setIsVisible(visible);
        review.setCreatedAt(createdAt);
        return reviewRepository.saveAndFlush(review);
    }

    private void saveResolvedComplaint(Long reviewId, Long orderId, Long complainantId, Long respondentId) {
        LocalDateTime now = LocalDateTime.now();
        ReviewComplaint complaint = new ReviewComplaint();
        complaint.setReviewId(reviewId);
        complaint.setOrderId(orderId);
        complaint.setComplainantId(complainantId);
        complaint.setRespondentId(respondentId);
        complaint.setReason("test complaint");
        complaint.setEvidenceFileIds("");
        complaint.setStatus("RESOLVED");
        complaint.setArbitrationResult("REVIEW_HIDDEN");
        complaint.setArbitrationComment("responsibility confirmed");
        complaint.setHandledBy(ADMIN_ID);
        complaint.setCreatedAt(now.minusHours(2));
        complaint.setUpdatedAt(now.minusHours(1));
        complaint.setHandledAt(now.minusHours(1));
        reviewComplaintRepository.saveAndFlush(complaint);
    }

    private void saveResolvedDispute(Long orderId,
                                     Long initiatorId,
                                     OrderStatus previousOrderStatus,
                                     String responsibility) {
        Dispute dispute = new Dispute();
        dispute.setOrderId(orderId);
        dispute.setInitiatorId(initiatorId);
        dispute.setPreviousOrderStatus(previousOrderStatus);
        dispute.setReason("test dispute");
        dispute.setStatus("RESOLVED");
        dispute.setResolution("REFUND_CONFIRMED");
        dispute.setResponsibility(responsibility);
        dispute.setRefundAmount(1000L);
        dispute.setAdminId(ADMIN_ID);
        dispute.setAdminComment("responsibility confirmed");
        dispute.setResolvedAt(LocalDateTime.now().minusMinutes(30));
        disputeRepository.saveAndFlush(dispute);
    }
}
