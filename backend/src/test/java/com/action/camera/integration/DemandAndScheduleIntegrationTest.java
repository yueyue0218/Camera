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
class DemandAndScheduleIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private JdbcTemplate jdbc;

    @BeforeEach
    void seedDemoUsers() {
        jdbc.execute("DELETE FROM users WHERE id IN (1001, 2001)");
        jdbc.execute("INSERT INTO users (id, nickname, current_role, status, credit_score, created_at, updated_at) " +
                "VALUES (1001, '需求方', 'CUSTOMER', 'ACTIVE', 80.00, NOW(), NOW())");
        jdbc.execute("INSERT INTO users (id, nickname, current_role, status, credit_score, created_at, updated_at) " +
                "VALUES (2001, '服务方', 'PROVIDER', 'ACTIVE', 80.00, NOW(), NOW())");
    }

    // ───────────── Demand tests ─────────────

    @Test
    void createDemand_noAuthHeader_usesDefaultCustomer() {
        String body = demandBody("PORTRAIT", "nanjing");
        ResponseEntity<Map> resp = rest.exchange("/demands", HttpMethod.POST, jsonEntity(body), Map.class);

        assertThat(resp.getBody().get("code")).isEqualTo(200);
        Map<String, Object> data = (Map<String, Object>) resp.getBody().get("data");
        assertThat(data.get("demandId")).isNotNull();
        assertThat(data.get("status")).isEqualTo("OPEN");
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

    // ───────────── Schedule tests ─────────────

    @Test
    void createSchedule_asProvider_succeeds() {
        String body = scheduleBody("nanjing", "2026-09-01T09:00:00", "2026-09-01T18:00:00");
        ResponseEntity<Map> resp = rest.exchange("/providers/me/schedules", HttpMethod.POST, asProvider(body), Map.class);

        assertThat(resp.getBody().get("code")).isEqualTo(200);
        Map<String, Object> data = (Map<String, Object>) resp.getBody().get("data");
        assertThat(data.get("scheduleId")).isNotNull();
    }

    @Test
    void createSchedule_conflictingTime_returns409() {
        String body1 = scheduleBody("nanjing", "2026-10-01T09:00:00", "2026-10-01T18:00:00");
        rest.exchange("/providers/me/schedules", HttpMethod.POST, asProvider(body1), Map.class);

        String body2 = scheduleBody("nanjing", "2026-10-01T14:00:00", "2026-10-01T20:00:00");
        ResponseEntity<Map> resp = rest.exchange("/providers/me/schedules", HttpMethod.POST, asProvider(body2), Map.class);

        assertThat(resp.getBody().get("code")).isEqualTo(40901);
    }

    @Test
    void createSchedule_asCustomer_returnsForbidden() {
        String body = scheduleBody("nanjing", "2026-11-01T09:00:00", "2026-11-01T18:00:00");
        ResponseEntity<Map> resp = rest.exchange("/providers/me/schedules", HttpMethod.POST, asCustomer(body), Map.class);

        assertThat(resp.getBody().get("code")).isNotEqualTo(200);
    }

    @Test
    void listPublicSchedules_noAuth_succeeds() {
        ResponseEntity<Map> resp = rest.getForEntity("/providers/2001/schedules", Map.class);
        assertThat(resp.getBody().get("code")).isEqualTo(200);
    }

    // ───────────── Helpers ─────────────

    private String demandBody(String scene, String cityCode) {
        return "{\"scene\":\"" + scene + "\",\"styleTags\":[\"natural\"]," +
                "\"expectedDate\":\"2026-08-15\",\"timeSlot\":\"AFTERNOON\"," +
                "\"cityCode\":\"" + cityCode + "\",\"location\":\"南京大学\"," +
                "\"budgetMinCent\":30000,\"budgetMaxCent\":80000,\"description\":\"集成测试需求\"}";
    }

    private String demandBodyWithScene(String scene, String cityCode) {
        return "{\"scene\":\"" + scene + "\",\"styleTags\":[\"natural\"]," +
                "\"expectedDate\":\"2026-08-15\",\"timeSlot\":\"AFTERNOON\"," +
                "\"cityCode\":\"" + cityCode + "\",\"location\":\"北京大学\"," +
                "\"budgetMinCent\":30000,\"budgetMaxCent\":80000,\"description\":\"集成测试需求\"}";
    }

    private String scheduleBody(String cityCode, String start, String end) {
        return "{\"cityCode\":\"" + cityCode + "\",\"startTime\":\"" + start +
                "\",\"endTime\":\"" + end + "\",\"timeSlot\":\"FULL_DAY\"}";
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
