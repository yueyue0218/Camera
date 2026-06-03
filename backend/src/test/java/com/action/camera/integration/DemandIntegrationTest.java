package com.action.camera.integration;

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

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = "spring.datasource.url=jdbc:h2:mem:camera_it;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;NON_KEYWORDS=CURRENT_ROLE;DB_CLOSE_DELAY=-1")
class DemandIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void seedDemoUsers() {
        jdbc.execute("DELETE FROM users WHERE id IN (1001, 1002, 2001)");
        jdbc.execute("INSERT INTO users (id, nickname, current_role, status, credit_score, created_at, updated_at) " +
                "VALUES (1001, '需求方', 'CUSTOMER', 'ACTIVE', 80.00, NOW(), NOW())");
        jdbc.execute("INSERT INTO users (id, nickname, current_role, status, credit_score, created_at, updated_at) " +
                "VALUES (1002, 'other customer', 'CUSTOMER', 'ACTIVE', 80.00, NOW(), NOW())");
        jdbc.execute("INSERT INTO users (id, nickname, current_role, status, credit_score, created_at, updated_at) " +
                "VALUES (2001, '服务方', 'PROVIDER', 'ACTIVE', 80.00, NOW(), NOW())");
    }

    // ───────────── Demand tests ─────────────

    @Test
    void createDemand_noAuthHeader_returnsUnauthorized() {
        String body = demandBody("PORTRAIT", "nanjing");
        ResponseEntity<Map> resp = rest.exchange("/demands", HttpMethod.POST, jsonEntity(body), Map.class);

        assertThat(resp.getBody().get("code")).isEqualTo(40101);
    }

    @Test
    void createDemand_withCustomerHeader_succeeds() {
        String body = demandBody("PORTRAIT", "nanjing");
        ResponseEntity<Map> resp = rest.exchange("/demands", HttpMethod.POST, asCustomer(body), Map.class);

        assertThat(resp.getBody().get("code")).isEqualTo(200);
        Map<String, Object> data = (Map<String, Object>) resp.getBody().get("data");
        assertThat(data.get("demandId")).isNotNull();
        assertThat(data.get("status")).isEqualTo("OPEN");
    }

    @Test
    void createDemand_asProvider_returnsForbidden() {
        String body = demandBody("PORTRAIT", "nanjing");
        ResponseEntity<Map> resp = rest.exchange("/demands", HttpMethod.POST, asProvider(body), Map.class);

        assertThat(resp.getBody().get("code")).isNotEqualTo(200);
    }

    @Test
    void listDemands_noAuth_succeeds() {
        ResponseEntity<Map> resp = rest.getForEntity("/demands", Map.class);

        assertThat(resp.getBody().get("code")).isEqualTo(200);
        assertThat(resp.getBody().get("data")).isNotNull();
    }

    @Test
    void listDemands_withFilters_returnsFiltered() {
        String body = demandBodyWithScene("GRADUATION", "beijing");
        rest.exchange("/demands", HttpMethod.POST, asCustomer(body), Map.class);

        ResponseEntity<Map> resp = rest.getForEntity("/demands?scene=GRADUATION&cityCode=beijing", Map.class);
        assertThat(resp.getBody().get("code")).isEqualTo(200);
        Map<String, Object> data = (Map<String, Object>) resp.getBody().get("data");
        List<Map<String, Object>> records = (List<Map<String, Object>>) data.get("records");
        assertThat(records).isNotEmpty();
        assertThat(records.get(0).get("scene")).isEqualTo("GRADUATION");
        assertThat(records.get(0).get("createdAt")).isNotNull();
        assertThat(records.get(0).get("updatedAt")).isNotNull();
    }

    @Test
    void listDemands_withTimeTag_returnsOnlyTaggedDemands() {
        rest.exchange("/demands", HttpMethod.POST, asCustomer(demandBodyWithScene("GRADUATION", "beijing")), Map.class);
        String untaggedBody = "{\"scene\":\"PORTRAIT\",\"styleTags\":[\"natural\"],"
                + "\"expectedDate\":\"2026-08-15\",\"timeSlot\":\"AFTERNOON\","
                + "\"timeDescription\":\"Flexible summer afternoons\",\"timeTags\":[],"
                + "\"cityCode\":\"beijing\",\"location\":\"PKU\","
                + "\"budgetMinCent\":30000,\"budgetMaxCent\":80000,\"description\":\"integration demand\"}";
        rest.exchange("/demands", HttpMethod.POST, asCustomer(untaggedBody), Map.class);

        ResponseEntity<Map> ordinary = rest.getForEntity("/demands", Map.class);
        ResponseEntity<Map> filtered = rest.getForEntity("/demands?timeTag=NEAR_7_DAYS", Map.class);

        assertThat(records(ordinary)).hasSizeGreaterThanOrEqualTo(2);
        assertThat(records(filtered)).allSatisfy(record ->
                assertThat((List<String>) record.get("timeTags")).contains("NEAR_7_DAYS"));
    }

    @Test
    void getDemand_ownDemand_succeeds() {
        String createBody = demandBody("PORTRAIT", "nanjing");
        ResponseEntity<Map> createResp = rest.exchange("/demands", HttpMethod.POST, asCustomer(createBody), Map.class);
        Map<String, Object> createdData = (Map<String, Object>) createResp.getBody().get("data");
        Long demandId = ((Number) createdData.get("demandId")).longValue();

        ResponseEntity<Map> resp = rest.exchange("/demands/" + demandId, HttpMethod.GET, asCustomer(null), Map.class);
        assertThat(resp.getBody().get("code")).isEqualTo(200);
        Map<String, Object> data = (Map<String, Object>) resp.getBody().get("data");
        assertThat(((Number) data.get("demandId")).longValue()).isEqualTo(demandId);
        assertThat(data.get("timeDescription")).isEqualTo("Available in mid August afternoons");
        assertThat(data.get("timeTags")).isEqualTo(List.of("NEAR_7_DAYS"));
    }

    @Test
    void getDemand_openDemand_noAuthSucceeds() {
        String createBody = demandBody("PORTRAIT", "nanjing");
        ResponseEntity<Map> createResp = rest.exchange("/demands", HttpMethod.POST, asCustomer(createBody), Map.class);
        Long demandId = ((Number) ((Map<String, Object>) createResp.getBody().get("data")).get("demandId")).longValue();

        ResponseEntity<Map> resp = rest.getForEntity("/demands/" + demandId, Map.class);

        assertThat(resp.getBody().get("code")).isEqualTo(200);
    }

    @Test
    void getDemand_closedDemand_noAuthDoesNotUseDefaultCustomerAsOwner() {
        String createBody = demandBody("PORTRAIT", "nanjing");
        ResponseEntity<Map> createResp = rest.exchange("/demands", HttpMethod.POST, asCustomer(createBody), Map.class);
        Long demandId = ((Number) ((Map<String, Object>) createResp.getBody().get("data")).get("demandId")).longValue();
        rest.exchange("/demands/" + demandId + "/close", HttpMethod.PATCH, asCustomer(null), Map.class);

        ResponseEntity<Map> anonymous = rest.getForEntity("/demands/" + demandId, Map.class);
        ResponseEntity<Map> owner = rest.exchange("/demands/" + demandId, HttpMethod.GET, asCustomer(null), Map.class);
        ResponseEntity<Map> stranger = rest.exchange("/demands/" + demandId, HttpMethod.GET,
                userEntity("1002", "CUSTOMER", null), Map.class);

        assertThat(anonymous.getBody().get("code")).isEqualTo(40301);
        assertThat(owner.getBody().get("code")).isEqualTo(200);
        assertThat(stranger.getBody().get("code")).isEqualTo(40301);
    }

    @Test
    void getDemand_nonExistent_returns404() {
        ResponseEntity<Map> resp = rest.exchange("/demands/99999999", HttpMethod.GET, asCustomer(null), Map.class);
        assertThat(resp.getBody().get("code")).isEqualTo(40401);
    }

    @Test
    void deleteDemand_byOwner_succeeds() {
        String createBody = demandBody("PORTRAIT", "nanjing");
        ResponseEntity<Map> createResp = rest.exchange("/demands", HttpMethod.POST, asCustomer(createBody), Map.class);
        Long demandId = ((Number) ((Map<String, Object>) createResp.getBody().get("data")).get("demandId")).longValue();

        ResponseEntity<Map> resp = rest.exchange("/demands/" + demandId, HttpMethod.DELETE, asCustomer(null), Map.class);
        assertThat(resp.getBody().get("code")).isEqualTo(200);
    }

    @Test
    void deleteDemand_byStranger_returnsForbidden() {
        String createBody = demandBody("PORTRAIT", "nanjing");
        ResponseEntity<Map> createResp = rest.exchange("/demands", HttpMethod.POST, asCustomer(createBody), Map.class);
        Long demandId = ((Number) ((Map<String, Object>) createResp.getBody().get("data")).get("demandId")).longValue();

        HttpEntity<Object> strangerEntity = userEntity("1002", "CUSTOMER", null);
        ResponseEntity<Map> resp = rest.exchange("/demands/" + demandId, HttpMethod.DELETE, strangerEntity, Map.class);
        assertThat(resp.getBody().get("code")).isEqualTo(40301);
    }

    @Test
    void respondToDemand_asProvider_succeeds() {
        String createBody = demandBody("PORTRAIT", "nanjing");
        ResponseEntity<Map> createResp = rest.exchange("/demands", HttpMethod.POST, asCustomer(createBody), Map.class);
        Long demandId = ((Number) ((Map<String, Object>) createResp.getBody().get("data")).get("demandId")).longValue();

        String responseBody = "{\"providerProfileId\":2001,\"message\":\"可以承接\",\"expectedPriceCent\":50000}";
        ResponseEntity<Map> resp = rest.exchange("/demands/" + demandId + "/responses",
                HttpMethod.POST, asProvider(responseBody), Map.class);

        assertThat(resp.getBody().get("code")).isEqualTo(200);
        Map<String, Object> data = (Map<String, Object>) resp.getBody().get("data");
        assertThat(data.get("responseId")).isNotNull();
        assertThat(data.get("status")).isEqualTo("PENDING_CUSTOMER_ACCEPT");
    }

    @Test
    void respondToDemand_duplicateResponse_returnsConflict() {
        String createBody = demandBody("PORTRAIT", "nanjing");
        ResponseEntity<Map> createResp = rest.exchange("/demands", HttpMethod.POST, asCustomer(createBody), Map.class);
        Long demandId = ((Number) ((Map<String, Object>) createResp.getBody().get("data")).get("demandId")).longValue();

        String responseBody = "{\"providerProfileId\":2001,\"message\":\"可以承接\",\"expectedPriceCent\":50000}";
        rest.exchange("/demands/" + demandId + "/responses", HttpMethod.POST, asProvider(responseBody), Map.class);

        ResponseEntity<Map> secondResp = rest.exchange("/demands/" + demandId + "/responses",
                HttpMethod.POST, asProvider(responseBody), Map.class);
        assertThat(secondResp.getBody().get("code")).isNotEqualTo(200);
    }

    // ───────────── Helpers ─────────────

    private String demandBody(String scene, String cityCode) {
        return "{\"scene\":\"" + scene + "\",\"styleTags\":[\"natural\"]," +
                "\"expectedDate\":\"2026-08-15\",\"timeSlot\":\"AFTERNOON\"," +
                "\"timeDescription\":\"Available in mid August afternoons\",\"timeTags\":[\"NEAR_7_DAYS\"]," +
                "\"cityCode\":\"" + cityCode + "\",\"location\":\"南京大学\"," +
                "\"budgetMinCent\":30000,\"budgetMaxCent\":80000,\"description\":\"集成测试需求\"}";
    }

    private String demandBodyWithScene(String scene, String cityCode) {
        return "{\"scene\":\"" + scene + "\",\"styleTags\":[\"natural\"]," +
                "\"expectedDate\":\"2026-08-15\",\"timeSlot\":\"AFTERNOON\"," +
                "\"timeDescription\":\"Available in mid August afternoons\",\"timeTags\":[\"NEAR_7_DAYS\"]," +
                "\"cityCode\":\"" + cityCode + "\",\"location\":\"北京大学\"," +
                "\"budgetMinCent\":30000,\"budgetMaxCent\":80000,\"description\":\"集成测试需求\"}";
    }

    private List<Map<String, Object>> records(ResponseEntity<Map> response) {
        assertThat(response.getBody().get("code")).isEqualTo(200);
        Map<String, Object> data = (Map<String, Object>) response.getBody().get("data");
        return (List<Map<String, Object>>) data.get("records");
    }

    private HttpEntity<String> asCustomer(String body) {
        HttpHeaders h = new HttpHeaders();
        h.set("X-User-Id", "1001");
        h.set("X-User-Role", "CUSTOMER");
        h.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(body, h);
    }

    private HttpEntity<String> asProvider(String body) {
        HttpHeaders h = new HttpHeaders();
        h.set("X-User-Id", "2001");
        h.set("X-User-Role", "PROVIDER");
        h.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(body, h);
    }

    private HttpEntity<Object> userEntity(String userId, String role, String body) {
        HttpHeaders h = new HttpHeaders();
        h.set("X-User-Id", userId);
        h.set("X-User-Role", role);
        h.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(body, h);
    }

    private HttpEntity<String> jsonEntity(String body) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(body, h);
    }
}
