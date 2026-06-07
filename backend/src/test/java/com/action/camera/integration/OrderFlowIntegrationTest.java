package com.action.camera.integration;

import com.action.camera.message.entity.Conversation;
import com.action.camera.message.entity.Quote;
import com.action.camera.message.enums.QuoteStatus;
import com.action.camera.message.repository.ConversationRepository;
import com.action.camera.message.repository.QuoteRepository;
import com.action.camera.order.entity.Order;
import com.action.camera.order.enums.EscrowStatus;
import com.action.camera.order.enums.OrderStatus;
import com.action.camera.order.repository.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = "spring.datasource.url=jdbc:h2:mem:camera_it;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;NON_KEYWORDS=CURRENT_ROLE;DB_CLOSE_DELAY=-1")
class OrderFlowIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ConversationRepository conversationRepository;

    @Autowired
    private QuoteRepository quoteRepository;

    @Autowired
    private OrderRepository orderRepository;

    @BeforeEach
    void seedDemoUsers() {
        jdbc.execute("DELETE FROM users WHERE id IN (1001, 2001)");
        jdbc.execute("INSERT INTO users (id, nickname, current_role, status, credit_score, created_at, updated_at) " +
                "VALUES (1001, '需求方', 'CUSTOMER', 'ACTIVE', 80.00, NOW(), NOW())");
        jdbc.execute("INSERT INTO users (id, nickname, current_role, status, credit_score, created_at, updated_at) " +
                "VALUES (2001, '服务方', 'PROVIDER', 'ACTIVE', 80.00, NOW(), NOW())");
    }

    // ───────────── Tests ─────────────

    @Test
    void mockPay_pendingOrder_statusBecomesPaidPendingShoot() {
        Order order = createOrderInStatus(OrderStatus.PENDING_PAYMENT);

        String payBody = "{\"payMethod\":\"MOCK_PAY\",\"amountCent\":50000}";
        ResponseEntity<Map> resp = rest.exchange(
                "/orders/" + order.getId() + "/payments",
                HttpMethod.POST, asCustomer(payBody), Map.class);

        assertThat(resp.getBody().get("code")).isEqualTo(200);
        Map<String, Object> data = (Map<String, Object>) resp.getBody().get("data");
        assertThat(data.get("orderStatus")).isEqualTo("PAID_PENDING_SHOOT");
    }

    @Test
    void mockPay_wrongAmount_returnsError() {
        Order order = createOrderInStatus(OrderStatus.PENDING_PAYMENT);

        String payBody = "{\"payMethod\":\"MOCK_PAY\",\"amountCent\":99999}";
        ResponseEntity<Map> resp = rest.exchange(
                "/orders/" + order.getId() + "/payments",
                HttpMethod.POST, asCustomer(payBody), Map.class);

        assertThat(resp.getBody().get("code")).isNotEqualTo(200);
    }

    @Test
    void mockPay_wrongUser_returnsForbidden() {
        Order order = createOrderInStatus(OrderStatus.PENDING_PAYMENT);

        String payBody = "{\"payMethod\":\"MOCK_PAY\",\"amountCent\":50000}";
        HttpEntity<?> strangerEntity = userEntity("9999", payBody);
        ResponseEntity<Map> resp = rest.exchange(
                "/orders/" + order.getId() + "/payments",
                HttpMethod.POST, strangerEntity, Map.class);

        assertThat(resp.getBody().get("code")).isEqualTo(40301);
    }

    @Test
    void mockPay_alreadyPaid_returnsError() {
        Order order = createOrderInStatus(OrderStatus.PAID_PENDING_SHOOT);

        String payBody = "{\"payMethod\":\"MOCK_PAY\",\"amountCent\":50000}";
        ResponseEntity<Map> resp = rest.exchange(
                "/orders/" + order.getId() + "/payments",
                HttpMethod.POST, asCustomer(payBody), Map.class);

        assertThat(resp.getBody().get("code")).isNotEqualTo(200);
    }

    @Test
    void statusTransition_paidToShooting_succeeds() {
        Order order = createOrderInStatus(OrderStatus.PAID_PENDING_SHOOT);

        String body = "{\"targetStatus\":\"SHOOTING\",\"reason\":\"开始拍摄\"}";
        ResponseEntity<Map> resp = rest.exchange(
                "/orders/" + order.getId() + "/status-transitions",
                HttpMethod.POST, asProvider(body), Map.class);

        assertThat(resp.getBody().get("code")).isEqualTo(200);
        Map<String, Object> data = (Map<String, Object>) resp.getBody().get("data");
        assertThat(data.get("toStatus")).isEqualTo("SHOOTING");
    }

    @Test
    void statusTransition_illegalJump_returnsError() {
        Order order = createOrderInStatus(OrderStatus.PENDING_PAYMENT);

        String body = "{\"targetStatus\":\"COMPLETED\",\"reason\":\"非法跳转\"}";
        ResponseEntity<Map> resp = rest.exchange(
                "/orders/" + order.getId() + "/status-transitions",
                HttpMethod.POST, asCustomer(body), Map.class);

        assertThat(resp.getBody().get("code")).isNotEqualTo(200);
    }

    @Test
    void getOrder_byParticipant_succeeds() {
        Order order = createOrderInStatus(OrderStatus.PENDING_PAYMENT);

        ResponseEntity<Map> resp = rest.exchange(
                "/orders/" + order.getId(),
                HttpMethod.GET, asCustomer(null), Map.class);

        assertThat(resp.getBody().get("code")).isEqualTo(200);
        Map<String, Object> data = (Map<String, Object>) resp.getBody().get("data");
        assertThat(((Number) data.get("orderId")).longValue()).isEqualTo(order.getId());
    }

    @Test
    void getOrder_byStranger_returnsForbidden() {
        Order order = createOrderInStatus(OrderStatus.PENDING_PAYMENT);

        HttpEntity<?> strangerEntity = userEntity("9999", null);
        ResponseEntity<Map> resp = rest.exchange(
                "/orders/" + order.getId(),
                HttpMethod.GET, strangerEntity, Map.class);

        assertThat(resp.getBody().get("code")).isEqualTo(40301);
    }

    @Test
    void listOrders_asCustomer_returnsOnlyMine() {
        createOrderInStatus(OrderStatus.PENDING_PAYMENT); // customer=1001

        ResponseEntity<Map> resp = rest.exchange(
                "/orders?role=customer",
                HttpMethod.GET, asCustomer(null), Map.class);

        assertThat(resp.getBody().get("code")).isEqualTo(200);
        List<Map<String, Object>> data = (List<Map<String, Object>>) resp.getBody().get("data");
        assertThat(data).isNotEmpty();
        data.forEach(o -> assertThat(((Number) o.get("customerId")).longValue()).isEqualTo(1001L));
    }

    @Test
    void statusLogs_afterTransition_containsLog() {
        Order order = createOrderInStatus(OrderStatus.PAID_PENDING_SHOOT);

        String body = "{\"targetStatus\":\"SHOOTING\",\"reason\":\"开始拍摄\"}";
        rest.exchange("/orders/" + order.getId() + "/status-transitions",
                HttpMethod.POST, asProvider(body), Map.class);

        ResponseEntity<Map> resp = rest.exchange(
                "/orders/" + order.getId() + "/status-logs",
                HttpMethod.GET, asCustomer(null), Map.class);

        assertThat(resp.getBody().get("code")).isEqualTo(200);
        List<Map<String, Object>> logs = (List<Map<String, Object>>) resp.getBody().get("data");
        assertThat(logs).isNotEmpty();
        boolean hasShootingLog = logs.stream()
                .anyMatch(log -> "SHOOTING".equals(log.get("toStatus")));
        assertThat(hasShootingLog).isTrue();
    }

    // ───────────── Data helpers ─────────────

    private Order createOrderInStatus(OrderStatus status) {
        LocalDateTime now = LocalDateTime.now();
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        long sourceId = Math.abs(UUID.randomUUID().getMostSignificantBits());
        if (sourceId == 0) {
            sourceId = 1L;
        }

        Conversation conv = new Conversation();
        conv.setParticipantAId(1001L);
        conv.setParticipantBId(2001L);
        conv.setSourceType("DEMAND_RESPONSE");
        conv.setSourceId(sourceId);
        conversationRepository.save(conv);

        Quote quote = new Quote();
        quote.setQuoteNo("QT" + suffix);
        quote.setConversationId(conv.getId());
        quote.setCustomerId(1001L);
        quote.setProviderUserId(2001L);
        quote.setSourceType("DEMAND_RESPONSE");
        quote.setSourceId(sourceId);
        quote.setAmountCent(50000L);
        quote.setShootStartTime(now.plusDays(7));
        quote.setShootEndTime(now.plusDays(7).plusHours(3));
        quote.setLocation("南京大学");
        quote.setDeliveryDeadline(now.plusDays(14));
        quote.setExpireTime(now.plusDays(1));
        quote.setStatus(QuoteStatus.CONFIRMED);
        quoteRepository.save(quote);

        Order order = new Order();
        order.setOrderNo("O" + DateTimeFormatter.ofPattern("yyyyMMddHHmmss").format(now) + suffix);
        order.setQuoteId(quote.getId());
        order.setConversationId(conv.getId());
        order.setCustomerId(1001L);
        order.setProviderUserId(2001L);
        order.setTotalAmountCent(50000L);
        order.setStatus(status);
        order.setEscrowStatus(EscrowStatus.NOT_PAID);
        order.setShootStartTime(now.plusDays(7));
        order.setShootEndTime(now.plusDays(7).plusHours(3));
        order.setShootLocation("南京大学");
        order.setDeliveryDeadline(now.plusDays(14));
        order.setCreatedAt(now);
        order.setUpdatedAt(now);
        return orderRepository.save(order);
    }

    // ───────────── HTTP helpers ─────────────

    private HttpEntity<String> asCustomer(String body) {
        HttpHeaders h = new HttpHeaders();
        h.set("X-User-Id", "1001");
        h.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(body, h);
    }

    private HttpEntity<String> asProvider(String body) {
        HttpHeaders h = new HttpHeaders();
        h.set("X-User-Id", "2001");
        h.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(body, h);
    }

    private HttpEntity<String> userEntity(String userId, String body) {
        HttpHeaders h = new HttpHeaders();
        h.set("X-User-Id", userId);
        h.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(body, h);
    }
}
