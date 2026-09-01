package com.action.camera.integration;

import com.action.camera.common.JwtUtil;
import com.action.camera.demand.repository.DemandRepository;
import com.action.camera.servicepackage.repository.ServicePackageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:b1_b2_route_auth_test;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;NON_KEYWORDS=CURRENT_ROLE;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect"
})
class B1B2RouteAuthIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private DemandRepository demandRepository;

    @Autowired
    private ServicePackageRepository servicePackageRepository;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private JwtUtil jwtUtil;

    @BeforeEach
    void cleanDatabase() {
        demandRepository.deleteAll();
        servicePackageRepository.deleteAll();
        jdbc.execute("DELETE FROM users WHERE id IN (1001, 2001, 910003)");
        jdbc.execute("INSERT INTO users (id, nickname, current_role, status, credit_score, created_at, updated_at) " +
                "VALUES (1001, 'Route auth customer', 'CUSTOMER', 'ACTIVE', 80.00, NOW(), NOW())");
        jdbc.execute("INSERT INTO users (id, nickname, current_role, status, credit_score, created_at, updated_at) " +
                "VALUES (2001, 'Route auth provider', 'PROVIDER', 'ACTIVE', 80.00, NOW(), NOW())");
    }

    @Test
    void oldDemandRouteAllowsPublicGetButRequiresAuthenticatedCustomerForWrites() {
        assertThat(rest.getForEntity("/demands", Map.class).getBody().get("code")).isEqualTo(200);

        ResponseEntity<Map> noAuthCreate =
                rest.exchange("/demands", HttpMethod.POST, jsonEntity(demandBody()), Map.class);
        assertThat(noAuthCreate.getBody().get("code")).isEqualTo(40101);

        ResponseEntity<Map> missingRoleCreate =
                rest.exchange("/demands", HttpMethod.POST, entityWithUserOnly("1001", demandBody()), Map.class);
        assertThat(missingRoleCreate.getBody().get("code")).isEqualTo(40101);

        ResponseEntity<Map> providerCreate =
                rest.exchange("/demands", HttpMethod.POST, userEntity("2001", "PROVIDER", demandBody()), Map.class);
        assertThat(providerCreate.getBody().get("code")).isEqualTo(40301);

        ResponseEntity<Map> customerCreate =
                rest.exchange("/demands", HttpMethod.POST, userEntity("1001", "CUSTOMER", demandBody()), Map.class);
        assertThat(customerCreate.getBody().get("code")).isEqualTo(200);
        Long demandId = numberValue(data(customerCreate), "demandId");

        ResponseEntity<Map> noAuthUpdate =
                rest.exchange("/demands/" + demandId, HttpMethod.PUT, jsonEntity(demandUpdateBody()), Map.class);
        assertThat(noAuthUpdate.getBody().get("code")).isEqualTo(40101);

        ResponseEntity<Map> providerUpdate =
                rest.exchange("/demands/" + demandId, HttpMethod.PUT,
                        userEntity("2001", "PROVIDER", demandUpdateBody()), Map.class);
        assertThat(providerUpdate.getBody().get("code")).isEqualTo(40301);

        ResponseEntity<Map> providerClose =
                rest.exchange("/demands/" + demandId + "/close", HttpMethod.PATCH,
                        userEntity("2001", "PROVIDER", null), Map.class);
        assertThat(providerClose.getBody().get("code")).isEqualTo(40301);
    }

    @Test
    void oldServiceRouteAllowsPublicGetButRequiresAuthenticatedProviderForProviderWrites() {
        assertThat(rest.getForEntity("/services", Map.class).getBody().get("code")).isEqualTo(200);

        ResponseEntity<Map> noAuthCreate =
                rest.exchange("/services", HttpMethod.POST, jsonEntity(servicePackageBody()), Map.class);
        assertThat(noAuthCreate.getBody().get("code")).isEqualTo(40101);

        ResponseEntity<Map> missingRoleCreate =
                rest.exchange("/services", HttpMethod.POST, entityWithUserOnly("2001", servicePackageBody()), Map.class);
        assertThat(missingRoleCreate.getBody().get("code")).isEqualTo(40101);

        ResponseEntity<Map> customerCreate =
                rest.exchange("/services", HttpMethod.POST,
                        userEntity("1001", "CUSTOMER", servicePackageBody()), Map.class);
        assertThat(customerCreate.getBody().get("code")).isEqualTo(40301);

        ResponseEntity<Map> providerCreate =
                rest.exchange("/services", HttpMethod.POST,
                        userEntity("2001", "PROVIDER", servicePackageBody()), Map.class);
        assertThat(providerCreate.getBody().get("code")).isEqualTo(200);
        Long serviceId = numberValue(data(providerCreate), "serviceId");

        ResponseEntity<Map> noAuthOffline =
                rest.exchange("/services/" + serviceId + "/offline", HttpMethod.PATCH, jsonEntity(null), Map.class);
        assertThat(noAuthOffline.getBody().get("code")).isEqualTo(40101);

        ResponseEntity<Map> customerOffline =
                rest.exchange("/services/" + serviceId + "/offline", HttpMethod.PATCH,
                        userEntity("1001", "CUSTOMER", null), Map.class);
        assertThat(customerOffline.getBody().get("code")).isEqualTo(40301);
    }

    @Test
    void publicHallGetRejectsRemovedDemoTokenEvenWithForgedHeaders() {
        Long serviceId = numberValue(data(rest.exchange("/service-packages", HttpMethod.POST,
                userEntity("2001", "PROVIDER", servicePackageBody()), Map.class)), "serviceId");
        Long demandId = numberValue(data(rest.exchange("/demands", HttpMethod.POST,
                userEntity("1001", "CUSTOMER", demandBody()), Map.class)), "demandId");

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-User-Id", "1001");
        headers.set("X-User-Role", "CUSTOMER");
        headers.setBearerAuth("demo-token-customer-1001");
        HttpEntity<String> demoEntity = new HttpEntity<>(null, headers);

        assertThat(rest.exchange("/service-packages", HttpMethod.GET, demoEntity, Map.class)
                .getBody().get("code")).isEqualTo(40101);
        assertThat(rest.exchange("/service-packages/" + serviceId, HttpMethod.GET, demoEntity, Map.class)
                .getBody().get("code")).isEqualTo(40101);
        assertThat(rest.exchange("/demands", HttpMethod.GET, demoEntity, Map.class)
                .getBody().get("code")).isEqualTo(40101);
        assertThat(rest.exchange("/demands/" + demandId, HttpMethod.GET, demoEntity, Map.class)
                .getBody().get("code")).isEqualTo(40101);
    }

    @Test
    void startChatRejectsUnknownDemoUserBeforeConversationCreation() {
        Long serviceId = numberValue(data(rest.exchange("/service-packages", HttpMethod.POST,
                userEntity("2001", "PROVIDER", servicePackageBody()), Map.class)), "serviceId");

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-User-Id", "910003");
        headers.set("X-User-Role", "CUSTOMER");
        headers.setBearerAuth("demo-token-customer-910003");
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<Map> response = rest.exchange("/service-packages/" + serviceId + "/start-chat",
                HttpMethod.POST,
                new HttpEntity<>("{\"initialMessage\":\"hello\"}", headers),
                Map.class);

        assertThat(response.getBody().get("code")).isEqualTo(40101);
    }

    @Test
    void ownerHistoryRoutesRequireExpectedRoles() {
        ResponseEntity<Map> customerCreate =
                rest.exchange("/demands", HttpMethod.POST, userEntity("1001", "CUSTOMER", demandBody()), Map.class);
        assertThat(customerCreate.getBody().get("code")).isEqualTo(200);

        ResponseEntity<Map> demandHistoryNoAuth =
                rest.exchange("/demands/me/history", HttpMethod.GET, jsonEntity(null), Map.class);
        ResponseEntity<Map> demandHistoryProvider =
                rest.exchange("/demands/me/history", HttpMethod.GET,
                        userEntity("2001", "PROVIDER", null), Map.class);
        ResponseEntity<Map> demandHistoryCustomer =
                rest.exchange("/demands/me/history", HttpMethod.GET,
                        userEntity("1001", "CUSTOMER", null), Map.class);

        assertThat(demandHistoryNoAuth.getBody().get("code")).isEqualTo(40101);
        assertThat(demandHistoryProvider.getBody().get("code")).isEqualTo(40301);
        assertThat(demandHistoryCustomer.getBody().get("code")).isEqualTo(200);

        ResponseEntity<Map> providerCreate =
                rest.exchange("/service-packages", HttpMethod.POST,
                        userEntity("2001", "PROVIDER", servicePackageBody()), Map.class);
        assertThat(providerCreate.getBody().get("code")).isEqualTo(200);
        Long serviceId = numberValue(data(providerCreate), "serviceId");

        ResponseEntity<Map> serviceHistoryNoAuth =
                rest.exchange("/service-packages/me/history", HttpMethod.GET, jsonEntity(null), Map.class);
        ResponseEntity<Map> serviceHistoryCustomer =
                rest.exchange("/service-packages/me/history", HttpMethod.GET,
                        userEntity("1001", "CUSTOMER", null), Map.class);
        ResponseEntity<Map> serviceHistoryProvider =
                rest.exchange("/service-packages/me/history", HttpMethod.GET,
                        userEntity("2001", "PROVIDER", null), Map.class);
        ResponseEntity<Map> hideByCustomer =
                rest.exchange("/service-packages/" + serviceId, HttpMethod.DELETE,
                        userEntity("1001", "CUSTOMER", null), Map.class);
        ResponseEntity<Map> hideByProvider =
                rest.exchange("/service-packages/" + serviceId, HttpMethod.DELETE,
                        userEntity("2001", "PROVIDER", null), Map.class);

        assertThat(serviceHistoryNoAuth.getBody().get("code")).isEqualTo(40101);
        assertThat(serviceHistoryCustomer.getBody().get("code")).isEqualTo(40301);
        assertThat(serviceHistoryProvider.getBody().get("code")).isEqualTo(200);
        assertThat(hideByCustomer.getBody().get("code")).isEqualTo(40301);
        assertThat(hideByProvider.getBody().get("code")).isEqualTo(200);
    }

    private HttpEntity<String> jsonEntity(String body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(body, headers);
    }

    private HttpEntity<String> entityWithUserOnly(String userId, String body) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-User-Id", userId);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(body, headers);
    }

    private HttpEntity<String> userEntity(String userId, String role, String body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwtUtil.generateToken(Long.valueOf(userId)));
        headers.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(body, headers);
    }

    private Map<String, Object> data(ResponseEntity<Map> response) {
        return (Map<String, Object>) response.getBody().get("data");
    }

    private Long numberValue(Map<String, Object> values, String key) {
        return ((Number) values.get(key)).longValue();
    }

    private String demandBody() {
        return """
                {
                  "scene":"PORTRAIT",
                  "styleTags":["natural"],
                  "expectedDate":"2026-08-15",
                  "timeSlot":"AFTERNOON",
                  "timeDescription":"Available in mid August afternoons",
                  "timeTags":["NEAR_7_DAYS"],
                  "cityCode":"nanjing",
                  "location":"NJU campus",
                  "budgetMinCent":30000,
                  "budgetMaxCent":80000,
                  "description":"Route auth test demand"
                }
                """;
    }

    private String demandUpdateBody() {
        return """
                {
                  "timeDescription":"Updated availability",
                  "timeTags":["NEAR_3_DAYS"]
                }
                """;
    }

    private String servicePackageBody() {
        return """
                {
                  "title":"Route auth portrait package",
                  "cityCode":"NJ",
                  "serviceArea":"NJU campus",
                  "scene":"PORTRAIT",
                  "styleTags":["natural"],
                  "images":["https://cdn.example/cover.jpg"],
                  "basePriceCent":39900,
                  "priceRange":"399-599",
                  "durationMinutes":120,
                  "originalCount":30,
                  "refinedCount":9,
                  "deliveryDays":7,
                  "availableDates":["2026-07-01"],
                  "portfolioIds":[11],
                  "description":"Route auth test package",
                  "timeDescription":"July weekends are available",
                  "timeTags":["NEAR_7_DAYS"]
                }
                """;
    }
}
