package com.action.camera.integration;

import com.action.camera.admin.repository.AuditRecordRepository;
import com.action.camera.common.JwtUtil;
import com.action.camera.demand.domain.Demand;
import com.action.camera.demand.domain.DemandResponse;
import com.action.camera.demand.repository.DemandRepository;
import com.action.camera.demand.repository.DemandResponseRepository;
import com.action.camera.message.entity.Conversation;
import com.action.camera.message.repository.ConversationRepository;
import com.action.camera.order.entity.Order;
import com.action.camera.order.enums.EscrowStatus;
import com.action.camera.order.enums.OrderStatus;
import com.action.camera.order.repository.OrderRepository;
import com.action.camera.report.repository.ReportRepository;
import com.action.camera.repository.UserRepository;
import com.action.camera.review.entity.Review;
import com.action.camera.review.entity.ReviewComplaint;
import com.action.camera.review.repository.ReviewComplaintRepository;
import com.action.camera.review.repository.ReviewRepository;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "spring.http.client.factory=simple")
@AutoConfigureMockMvc
@ActiveProfiles("smoke")
class AdminGovernanceIntegrationTest {

    private static final Long ADMIN_ID = 92701L;
    private static final Long CUSTOMER_ID = 92702L;
    private static final Long PROVIDER_ID = 92703L;
    private static final Long TARGET_ID = 92704L;

    @Autowired private MockMvc mockMvc;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private DemandRepository demandRepository;
    @Autowired private DemandResponseRepository demandResponseRepository;
    @Autowired private ConversationRepository conversationRepository;
    @Autowired private OrderRepository orderRepository;
    @Autowired private ReportRepository reportRepository;
    @Autowired private ReviewRepository reviewRepository;
    @Autowired private ReviewComplaintRepository reviewComplaintRepository;
    @Autowired private AuditRecordRepository auditRecordRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        auditRecordRepository.deleteAll();
        reportRepository.deleteAll();
        reviewComplaintRepository.deleteAll();
        reviewRepository.deleteAll();
        orderRepository.deleteAll();
        conversationRepository.deleteAll();
        demandResponseRepository.deleteAll();
        demandRepository.deleteAll();
        jdbcTemplate.update("DELETE FROM users WHERE id IN (?, ?, ?, ?)",
                ADMIN_ID, CUSTOMER_ID, PROVIDER_ID, TARGET_ID);
        insertUser(ADMIN_ID, "governance-admin", "ADMIN");
        insertUser(CUSTOMER_ID, "governance-customer", "CUSTOMER");
        insertUser(PROVIDER_ID, "governance-provider", "PROVIDER");
        insertUser(TARGET_ID, "governance-target", "CUSTOMER");
    }

    @Test
    void reportTakeDownRestoreUpdatesPublicVisibilityDashboardAndAuditAtomically() throws Exception {
        Demand demand = saveDemand(CUSTOMER_ID, "governance lifecycle demand");
        long pendingBefore = dashboardLong("pendingReportCount");
        long removedBefore = dashboardLong("removedContentCount");

        String reportBody = mockMvc.perform(post("/reports")
                        .header(HttpHeaders.AUTHORIZATION, bearer(PROVIDER_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetType\":\"DEMAND\",\"targetId\":" + demand.getId()
                                + ",\"reason\":\"policy violation\",\"description\":\"cross-domain test\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andReturn().getResponse().getContentAsString();
        Long reportId = ((Number) JsonPath.read(reportBody, "$.data.reportId")).longValue();
        assertThat(dashboardLong("pendingReportCount")).isEqualTo(pendingBefore + 1);

        mockMvc.perform(patch("/admin/reports/{reportId}/resolve", reportId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(ADMIN_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"resolution\":\"TAKE_DOWN\",\"adminComment\":\"confirmed violation\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RESOLVED"))
                .andExpect(jsonPath("$.data.resolution").value("TAKE_DOWN"));

        mockMvc.perform(get("/demands"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records[*].demandId", not(hasItem(demand.getId().intValue()))));
        mockMvc.perform(get("/demands/{id}", demand.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(40401));
        assertThat(demandRepository.findById(demand.getId()).orElseThrow().getStatus().name()).isEqualTo("OPEN");
        assertThat(dashboardLong("pendingReportCount")).isEqualTo(pendingBefore);
        assertThat(dashboardLong("removedContentCount")).isEqualTo(removedBefore + 1);
        assertThat(auditRecordRepository.findAll())
                .extracting("auditType", "targetId", "auditResult")
                .contains(
                        org.assertj.core.groups.Tuple.tuple("DEMAND", demand.getId(), "TAKE_DOWN"),
                        org.assertj.core.groups.Tuple.tuple("REPORT", reportId, "RESOLVE"));

        mockMvc.perform(patch("/admin/hall-items/DEMAND/{id}/restore", demand.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(ADMIN_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"appeal accepted\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.moderationStatus").value("VISIBLE"));
        mockMvc.perform(get("/demands"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records[*].demandId", hasItem(demand.getId().intValue())));
        mockMvc.perform(get("/demands/{id}", demand.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.demandId").value(demand.getId()));
        assertThat(auditRecordRepository.findTop10ByAuditTypeAndTargetIdOrderByCreatedAtDesc("DEMAND", demand.getId()))
                .extracting("auditResult")
                .contains("TAKE_DOWN", "RESTORE");
    }

    @Test
    void reportRestrictionImmediatelyInvalidatesTargetOldJwt() throws Exception {
        String targetOldJwt = bearer(TARGET_ID);

        mockMvc.perform(get("/notifications").header(HttpHeaders.AUTHORIZATION, targetOldJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        String reportBody = mockMvc.perform(post("/reports")
                        .header(HttpHeaders.AUTHORIZATION, bearer(CUSTOMER_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetType\":\"USER\",\"targetId\":" + TARGET_ID
                                + ",\"reason\":\"account abuse\",\"description\":\"old jwt invalidation\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andReturn().getResponse().getContentAsString();
        Long reportId = ((Number) JsonPath.read(reportBody, "$.data.reportId")).longValue();

        mockMvc.perform(patch("/admin/reports/{reportId}/resolve", reportId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(ADMIN_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"resolution\":\"RESTRICT_USER\",\"adminComment\":\"confirmed abuse\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RESOLVED"));

        mockMvc.perform(get("/notifications").header(HttpHeaders.AUTHORIZATION, targetOldJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(40101));
        assertThat(userRepository.findById(TARGET_ID).orElseThrow().getStatus()).isEqualTo("DISABLED");
    }

    @Test
    void reviewComplaintArbitrationAlwaysCreatesAuditRecord() throws Exception {
        long sourceId = 70001L;
        for (String result : List.of("REJECTED", "REVIEW_HIDDEN")) {
            Order order = saveOrder(saveConversation(sourceId++));
            Review review = saveReview(order.getId(), result);
            ReviewComplaint complaint = saveComplaint(review, result);

            mockMvc.perform(patch("/admin/review-complaints/{id}/arbitration", complaint.getId())
                            .header(HttpHeaders.AUTHORIZATION, bearer(ADMIN_ID))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"result\":\"" + result + "\",\"comment\":\"governance decision\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.status").value("RESOLVED"))
                    .andExpect(jsonPath("$.data.arbitrationResult").value(result));

            assertThat(auditRecordRepository.findTop10ByAuditTypeAndTargetIdOrderByCreatedAtDesc(
                    "REVIEW_COMPLAINT", complaint.getId()))
                    .extracting("adminId", "auditResult", "remark")
                    .containsExactly(org.assertj.core.groups.Tuple.tuple(
                            ADMIN_ID, "ARBITRATE", result + ": governance decision"));
        }
    }

    @Test
    void allAdminReadAndWriteRoutesRejectOrdinaryUser() throws Exception {
        String ordinaryJwt = bearer(CUSTOMER_ID);
        for (MockHttpServletRequestBuilder request : List.of(
                get("/admin/dashboard"),
                get("/admin/users"),
                get("/admin/users/{id}", TARGET_ID),
                patch("/admin/users/{id}/status", TARGET_ID).content("{\"status\":\"DISABLED\",\"reason\":\"test\"}"),
                get("/admin/certifications"),
                patch("/admin/certifications/REAL_NAME/{id}/review", 999999L).content("{\"result\":\"APPROVED\"}"),
                get("/admin/hall-items"),
                patch("/admin/hall-items/DEMAND/{id}/take-down", 999999L).content("{\"reason\":\"test\"}"),
                patch("/admin/hall-items/DEMAND/{id}/restore", 999999L).content("{\"reason\":\"test\"}"),
                get("/admin/moments"),
                patch("/admin/moments/{id}/take-down", 999999L).content("{\"reason\":\"test\"}"),
                patch("/admin/moments/{id}/restore", 999999L).content("{\"reason\":\"test\"}"),
                get("/admin/reports"),
                get("/admin/reports/{id}", 999999L),
                patch("/admin/reports/{id}/resolve", 999999L).content("{\"resolution\":\"IGNORE\",\"adminComment\":\"test\"}"),
                get("/admin/review-complaints"),
                patch("/admin/review-complaints/{id}/arbitration", 999999L).content("{\"result\":\"REJECTED\",\"comment\":\"test\"}"),
                patch("/admin/disputes/{id}/arbitration", 999999L)
                        .content("{\"resolution\":\"REFUND\",\"responsibility\":\"PROVIDER\",\"refundAmount\":100,\"comment\":\"test\"}"),
                get("/api/admin/certifications"),
                post("/api/admin/certifications/{id}/approve", 999999L),
                post("/api/admin/certifications/{id}/reject", 999999L)
                        .content("{\"rejectReason\":\"test\"}")
        )) {
            mockMvc.perform(request.header(HttpHeaders.AUTHORIZATION, ordinaryJwt)
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.code").value(40301));
        }
    }

    @Test
    void existingOrderConversationAndAcceptedDemandSnapshotSurviveContentTakeDown() throws Exception {
        Demand demand = saveDemand(CUSTOMER_ID, "preserved lifecycle demand");
        DemandResponse acceptedResponse = new DemandResponse(
                demand.getId(), PROVIDER_ID, PROVIDER_ID, "accepted response", 30000, LocalDateTime.now());
        acceptedResponse.accept();
        acceptedResponse = demandResponseRepository.saveAndFlush(acceptedResponse);
        Conversation conversation = saveConversation(acceptedResponse.getId());
        Order order = saveOrder(conversation);
        order.setDemandId(demand.getId());
        order = orderRepository.saveAndFlush(order);
        conversation.setOrderId(order.getId());
        conversation = conversationRepository.saveAndFlush(conversation);

        OrderStatus orderStatusBefore = order.getStatus();
        EscrowStatus escrowStatusBefore = order.getEscrowStatus();
        Long orderConversationIdBefore = order.getConversationId();
        Long conversationOrderIdBefore = conversation.getOrderId();
        String conversationSourceTypeBefore = conversation.getSourceType();
        Long conversationSourceIdBefore = conversation.getSourceId();
        Long participantABefore = conversation.getParticipantAId();
        Long participantBBefore = conversation.getParticipantBId();

        mockMvc.perform(patch("/admin/hall-items/DEMAND/{id}/take-down", demand.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(ADMIN_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"policy violation\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.moderationStatus").value("HIDDEN"));

        mockMvc.perform(get("/demands/responses/{id}/accepted-snapshot", acceptedResponse.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(CUSTOMER_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.responseId").value(acceptedResponse.getId()))
                .andExpect(jsonPath("$.data.demandId").value(demand.getId()))
                .andExpect(jsonPath("$.data.responseStatus").value("ACCEPTED"));
        Order preservedOrder = orderRepository.findById(order.getId()).orElseThrow();
        Conversation preservedConversation = conversationRepository.findById(conversation.getId()).orElseThrow();
        assertThat(preservedOrder.getStatus()).isEqualTo(orderStatusBefore);
        assertThat(preservedOrder.getEscrowStatus()).isEqualTo(escrowStatusBefore);
        assertThat(preservedOrder.getConversationId()).isEqualTo(orderConversationIdBefore);
        assertThat(preservedConversation.getOrderId()).isEqualTo(conversationOrderIdBefore);
        assertThat(preservedConversation.getSourceType()).isEqualTo(conversationSourceTypeBefore);
        assertThat(preservedConversation.getSourceId()).isEqualTo(conversationSourceIdBefore);
        assertThat(preservedConversation.getParticipantAId()).isEqualTo(participantABefore);
        assertThat(preservedConversation.getParticipantBId()).isEqualTo(participantBBefore);
        assertThat(demandResponseRepository.findById(acceptedResponse.getId()).orElseThrow().getStatus().name())
                .isEqualTo("ACCEPTED");
    }

    private long dashboardLong(String field) throws Exception {
        String body = mockMvc.perform(get("/admin/dashboard").header(HttpHeaders.AUTHORIZATION, bearer(ADMIN_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(body, "$.data." + field)).longValue();
    }

    private Demand saveDemand(Long customerId, String description) {
        LocalDateTime createdAt = LocalDateTime.of(2026, 9, 1, 9, 0);
        return demandRepository.saveAndFlush(new Demand(customerId, "PORTRAIT", List.of("natural"),
                LocalDate.of(2026, 9, 10), "14:00-16:00", "weekday afternoons", List.of("NEAR_1_MONTH"),
                "NJ", "NJU campus", 20000, 40000, description, List.of(), createdAt, createdAt.plusDays(30)));
    }

    private Conversation saveConversation(Long sourceId) {
        Conversation conversation = new Conversation();
        conversation.setParticipantAId(CUSTOMER_ID);
        conversation.setParticipantBId(PROVIDER_ID);
        conversation.setSourceType("DEMAND_RESPONSE");
        conversation.setSourceId(sourceId);
        conversation.setOrderId(0L);
        conversation.setCreatedAt(LocalDateTime.now());
        return conversationRepository.saveAndFlush(conversation);
    }

    private Order saveOrder(Conversation conversation) {
        Order order = new Order();
        order.setOrderNo("GOVERNANCE-" + conversation.getId());
        order.setQuoteId(800000L + conversation.getId());
        order.setConversationId(conversation.getId());
        order.setCustomerId(CUSTOMER_ID);
        order.setProviderUserId(PROVIDER_ID);
        order.setStatus(OrderStatus.PAID_PENDING_SHOOT);
        order.setEscrowStatus(EscrowStatus.HELD);
        order.setTotalAmountCent(30000L);
        order.setShootStartTime(LocalDateTime.now().plusDays(1));
        order.setShootEndTime(LocalDateTime.now().plusDays(1).plusHours(1));
        order.setShootLocation("NJU campus");
        order.setDeliveryDeadline(LocalDateTime.now().plusDays(7));
        return orderRepository.saveAndFlush(order);
    }

    private Review saveReview(Long orderId, String suffix) {
        Review review = new Review();
        review.setOrderId(orderId);
        review.setReviewerId(CUSTOMER_ID);
        review.setTargetUserId(PROVIDER_ID);
        review.setDirection("CUSTOMER_TO_PROVIDER");
        review.setRating(1);
        review.setContent("review " + suffix);
        review.setIsVisible(true);
        review.setCreatedAt(LocalDateTime.now());
        return reviewRepository.saveAndFlush(review);
    }

    private ReviewComplaint saveComplaint(Review review, String suffix) {
        ReviewComplaint complaint = new ReviewComplaint();
        complaint.setReviewId(review.getId());
        complaint.setOrderId(review.getOrderId());
        complaint.setComplainantId(PROVIDER_ID);
        complaint.setRespondentId(CUSTOMER_ID);
        complaint.setReason("complaint " + suffix);
        complaint.setStatus("PENDING");
        complaint.setCreatedAt(LocalDateTime.now());
        complaint.setUpdatedAt(LocalDateTime.now());
        return reviewComplaintRepository.saveAndFlush(complaint);
    }

    private String bearer(Long userId) {
        return "Bearer " + jwtUtil.generateToken(userId);
    }

    private void insertUser(Long id, String nickname, String role) {
        jdbcTemplate.update("""
                INSERT INTO users (id, nickname, current_role, status, credit_score, created_at, updated_at)
                VALUES (?, ?, ?, 'ACTIVE', 80.00, NOW(), NOW())
                """, id, nickname, role);
    }
}
