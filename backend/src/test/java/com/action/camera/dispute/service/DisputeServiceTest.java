package com.action.camera.dispute.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.dispute.dto.DisputeArbitrateRequest;
import com.action.camera.dispute.dto.DisputeCreateRequest;
import com.action.camera.dispute.dto.DisputeReplyRequest;
import com.action.camera.dispute.dto.DisputeResponse;
import com.action.camera.dispute.repository.DisputeRepository;
import com.action.camera.order.enums.OrderStatus;
import com.action.camera.order.repository.OrderRepository;
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
class DisputeServiceTest {

    private static final Long CUSTOMER_ID         = 1001L;
    private static final Long PROVIDER_ID         = 2001L;
    private static final Long OUTSIDER_ID         = 3001L;
    private static final Long ADMIN_ID            = 4001L;

    /** 用于申诉流程测试，初始状态 DELIVERED_PENDING_CONFIRM */
    private static final Long DISPUTE_ORDER_ID    = 8301L;
    /** 已完成订单，用于测试 STATUS_CONFLICT */
    private static final Long COMPLETED_ORDER_ID  = 8302L;

    private static final Long CONV_ID             = 9301L;
    private static final Long QUOTE_ID            = 7301L;

    @Autowired
    private DisputeService disputeService;

    @Autowired
    private DisputeRepository disputeRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        insertUser(CUSTOMER_ID, "dispute-customer", "CUSTOMER");
        insertUser(PROVIDER_ID, "dispute-provider", "PROVIDER");
        insertUser(OUTSIDER_ID, "dispute-outsider", "CUSTOMER");
        insertUser(ADMIN_ID,    "dispute-admin",    "ADMIN");
        insertConversation();
        insertQuote();
        insertOrder(DISPUTE_ORDER_ID,   "ORDER-DISPUTE-TEST",    "DELIVERED_PENDING_CONFIRM");
        insertOrder(COMPLETED_ORDER_ID, "ORDER-COMPLETED-TEST",  "COMPLETED");
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    // ────────────────────────────────────────────────
    // 1. 订单双方均可成功发起申诉
    // ────────────────────────────────────────────────

    @Test
    void orderParticipantsCanSuccessfullyCreateDispute() {
        DisputeResponse response = disputeService.createDispute(
                DISPUTE_ORDER_ID, CUSTOMER_ID, new DisputeCreateRequest("拍摄质量不达标"));

        assertThat(response.status()).isEqualTo("OPEN");
        assertThat(response.orderId()).isEqualTo(DISPUTE_ORDER_ID);
        assertThat(response.initiatorId()).isEqualTo(CUSTOMER_ID);
        assertThat(response.id()).isNotNull();
        assertThat(orderRepository.findById(DISPUTE_ORDER_ID))
                .get().extracting(o -> o.getStatus()).isEqualTo(OrderStatus.APPEALING);
    }

    // ────────────────────────────────────────────────
    // 2. 非订单参与方发起申诉 → FORBIDDEN
    // ────────────────────────────────────────────────

    @Test
    void outsiderCreatingDisputeThrowsForbidden() {
        assertThatThrownBy(() ->
                disputeService.createDispute(DISPUTE_ORDER_ID, OUTSIDER_ID,
                        new DisputeCreateRequest("无关投诉")))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    // ────────────────────────────────────────────────
    // 3. 已完成订单发起申诉 → STATUS_CONFLICT
    // ────────────────────────────────────────────────

    @Test
    void creatingDisputeOnCompletedOrderThrowsStatusConflict() {
        assertThatThrownBy(() ->
                disputeService.createDispute(COMPLETED_ORDER_ID, CUSTOMER_ID,
                        new DisputeCreateRequest("完成后投诉")))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.STATUS_CONFLICT);
    }

    // ────────────────────────────────────────────────
    // 4. 同一订单存在 OPEN 申诉时再次发起 → DUPLICATE_OPERATION
    // ────────────────────────────────────────────────

    @Test
    void creatingDuplicateOpenDisputeThrowsDuplicateOperation() {
        disputeService.createDispute(DISPUTE_ORDER_ID, CUSTOMER_ID,
                new DisputeCreateRequest("第一次申诉"));

        assertThatThrownBy(() ->
                disputeService.createDispute(DISPUTE_ORDER_ID, PROVIDER_ID,
                        new DisputeCreateRequest("重复申诉")))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.DUPLICATE_OPERATION);
    }

    // ────────────────────────────────────────────────
    // 5. 订单另一方成功回复 OPEN 申诉 → status=REPLIED
    // ────────────────────────────────────────────────

    @Test
    void otherPartyCanSuccessfullyReplyOpenDispute() {
        DisputeResponse created = disputeService.createDispute(
                DISPUTE_ORDER_ID, CUSTOMER_ID, new DisputeCreateRequest("交付延迟"));

        DisputeResponse replied = disputeService.replyDispute(
                created.id(), PROVIDER_ID, new DisputeReplyRequest("我已尽力，请谅解"));

        assertThat(replied.status()).isEqualTo("REPLIED");
        assertThat(replied.id()).isEqualTo(created.id());
        assertThat(replied.replies()).hasSize(1);
        assertThat(replied.replies().get(0).replierId()).isEqualTo(PROVIDER_ID);
        assertThat(replied.replies().get(0).content()).isEqualTo("我已尽力，请谅解");
    }

    // ────────────────────────────────────────────────
    // 6. 申诉发起人自己不能回复 → FORBIDDEN
    // ────────────────────────────────────────────────

    @Test
    void initiatorReplyingOwnDisputeThrowsForbidden() {
        DisputeResponse created = disputeService.createDispute(
                DISPUTE_ORDER_ID, CUSTOMER_ID, new DisputeCreateRequest("发起人自己回复测试"));

        assertThatThrownBy(() ->
                disputeService.replyDispute(created.id(), CUSTOMER_ID,
                        new DisputeReplyRequest("我自己回复自己")))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    // ────────────────────────────────────────────────
    // 7. ADMIN 裁定 FULL_REFUND → dispute=RESOLVED, order=REFUNDED
    // ────────────────────────────────────────────────

    @Test
    void adminArbitratingFullRefundResolvesDisputeAndRefundsOrder() {
        DisputeResponse created = disputeService.createDispute(
                DISPUTE_ORDER_ID, CUSTOMER_ID, new DisputeCreateRequest("要求全额退款"));

        DisputeResponse resolved = disputeService.arbitrate(
                created.id(), ADMIN_ID,
                new DisputeArbitrateRequest("FULL_REFUND", "核实属实，全额退款"));

        assertThat(resolved.status()).isEqualTo("RESOLVED");
        assertThat(resolved.resolution()).isEqualTo("FULL_REFUND");
        assertThat(resolved.adminId()).isEqualTo(ADMIN_ID);
        assertThat(resolved.adminComment()).isEqualTo("核实属实，全额退款");
        assertThat(resolved.resolvedAt()).isNotNull();

        assertThat(orderRepository.findById(DISPUTE_ORDER_ID))
                .get().extracting(o -> o.getStatus()).isEqualTo(OrderStatus.REFUNDED);
    }

    // ────────────────────────────────────────────────
    // 8. ADMIN 裁定 REWORK → order=REWORK_REQUIRED
    // ────────────────────────────────────────────────

    @Test
    void adminArbitratingReworkSetsOrderToReworkRequired() {
        DisputeResponse created = disputeService.createDispute(
                DISPUTE_ORDER_ID, PROVIDER_ID, new DisputeCreateRequest("服务方要求返修"));

        DisputeResponse resolved = disputeService.arbitrate(
                created.id(), ADMIN_ID,
                new DisputeArbitrateRequest("REWORK", "要求服务方重新交付"));

        assertThat(resolved.status()).isEqualTo("RESOLVED");
        assertThat(resolved.resolution()).isEqualTo("REWORK");

        assertThat(orderRepository.findById(DISPUTE_ORDER_ID))
                .get().extracting(o -> o.getStatus()).isEqualTo(OrderStatus.REWORK_REQUIRED);
    }

    // ────────────────────────────────────────────────
    // 9. 非 ADMIN 调用 arbitrate → FORBIDDEN
    // ────────────────────────────────────────────────

    @Test
    void nonAdminArbitratingThrowsForbidden() {
        DisputeResponse created = disputeService.createDispute(
                DISPUTE_ORDER_ID, CUSTOMER_ID, new DisputeCreateRequest("权限测试申诉"));

        assertThatThrownBy(() ->
                disputeService.arbitrate(created.id(), OUTSIDER_ID,
                        new DisputeArbitrateRequest("REJECTED", "越权裁定")))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    // ────────────────────────────────────────────────
    // 10. 已 RESOLVED 申诉再次裁定 → STATUS_CONFLICT
    // ────────────────────────────────────────────────

    @Test
    void rearbitratingResolvedDisputeThrowsStatusConflict() {
        DisputeResponse created = disputeService.createDispute(
                DISPUTE_ORDER_ID, CUSTOMER_ID, new DisputeCreateRequest("重复裁定测试"));
        disputeService.arbitrate(created.id(), ADMIN_ID,
                new DisputeArbitrateRequest("REJECTED", "驳回申诉"));

        assertThatThrownBy(() ->
                disputeService.arbitrate(created.id(), ADMIN_ID,
                        new DisputeArbitrateRequest("FULL_REFUND", "再次裁定")))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.STATUS_CONFLICT);
    }

    // ────────────────────────────────────────────────
    // helpers
    // ────────────────────────────────────────────────

    private void insertUser(Long userId, String nickname, String currentRole) {
        jdbcTemplate.update("""
                INSERT INTO users (id, nickname, current_role, status, credit_score, created_at, updated_at)
                VALUES (?, ?, ?, 'ACTIVE', 80.00, NOW(), NOW())
                ON DUPLICATE KEY UPDATE nickname = VALUES(nickname), current_role = VALUES(current_role)
                """, userId, nickname, currentRole);
    }

    private void insertConversation() {
        jdbcTemplate.update("""
                INSERT INTO conversations (id, participant_a_id, participant_b_id, source_type, created_at)
                VALUES (?, ?, ?, 'DIRECT', NOW())
                ON DUPLICATE KEY UPDATE participant_a_id = VALUES(participant_a_id)
                """, CONV_ID, CUSTOMER_ID, PROVIDER_ID);
    }

    private void insertQuote() {
        jdbcTemplate.update("""
                INSERT INTO quotes (
                    id, quote_no, conversation_id, provider_user_id, customer_id, source_type,
                    shoot_start_time, shoot_end_time, location, original_count, refined_count,
                    delivery_deadline, photo_usage_scope, service_snapshot_json, total_amount,
                    status, expire_time, created_at, updated_at
                )
                VALUES (
                    ?, 'QUOTE-DISPUTE-TEST', ?, ?, ?, 'DIRECT',
                    NOW(), DATEADD('HOUR', 1, NOW()), 'test-location', 0, 1,
                    DATEADD('DAY', 1, NOW()), 'PERSONAL_ONLY', JSON_OBJECT(), 100.00,
                    'CONFIRMED', DATEADD('DAY', 1, NOW()), NOW(), NOW()
                )
                ON DUPLICATE KEY UPDATE conversation_id = VALUES(conversation_id)
                """, QUOTE_ID, CONV_ID, PROVIDER_ID, CUSTOMER_ID);
    }

    private void insertOrder(Long orderId, String orderNo, String status) {
        jdbcTemplate.update("""
                INSERT INTO orders (
                    id, order_no, quote_id, conversation_id, customer_id, provider_user_id,
                    status, escrow_status, settlement_status, refund_status, total_amount,
                    platform_fee, provider_income, shoot_start_time, shoot_end_time, shoot_location,
                    delivery_deadline, photo_usage_scope, quote_snapshot_json, safety_notice_confirmed,
                    created_at, updated_at
                )
                VALUES (
                    ?, ?, ?, ?, ?, ?,
                    ?, 'HELD', 'NOT_SETTLED', 'NONE', 100.00,
                    0.00, 100.00, NOW(), DATEADD('HOUR', 1, NOW()), 'test-location',
                    DATEADD('DAY', 1, NOW()), 'PERSONAL_ONLY', JSON_OBJECT(), FALSE,
                    NOW(), NOW()
                )
                ON DUPLICATE KEY UPDATE status = VALUES(status)
                """, orderId, orderNo, QUOTE_ID, CONV_ID, CUSTOMER_ID, PROVIDER_ID, status);
    }
}
