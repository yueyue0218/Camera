package com.action.camera.integration;

import com.action.camera.common.JwtUtil;
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
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = "spring.datasource.url=jdbc:h2:mem:camera_it;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;NON_KEYWORDS=CURRENT_ROLE;DB_CLOSE_DELAY=-1")
class AuthAndSessionIntegrationTest {

    @Autowired
    private TestRestTemplate rest;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private RequestMappingHandlerMapping handlerMapping;

    @BeforeEach
    void seedDemoUsers() {
        jdbc.execute("DELETE FROM users WHERE id IN (1001, 2001)");
        jdbc.execute("INSERT INTO users (id, nickname, current_role, status, credit_score, created_at, updated_at) " +
                "VALUES (1001, '需求方', 'CUSTOMER', 'ACTIVE', 80.00, NOW(), NOW())");
        jdbc.execute("INSERT INTO users (id, nickname, current_role, status, credit_score, created_at, updated_at) " +
                "VALUES (2001, '服务方', 'PROVIDER', 'ACTIVE', 80.00, NOW(), NOW())");
    }

    @Test
    void testAndDebugEndpoints_areNotMapped() {
        assertThat(handlerMapping.getHandlerMethods().keySet())
                .flatExtracting(mapping -> mapping.getPatternValues())
                .noneMatch(path -> path.startsWith("/test") || path.startsWith("/secure"));
    }

    @Test
    void removedSessionEndpoint_doesNotIssueCustomerDemoToken() {
        String body = "{\"loginType\":\"MOBILE\",\"mobile\":\"13800138001\",\"verifyCode\":\"123456\",\"role\":\"CUSTOMER\"}";
        HttpEntity<String> entity = jsonEntity(body);
        ResponseEntity<Map> resp = rest.exchange("/sessions", HttpMethod.POST, entity, Map.class);

        assertThat(resp.getBody().get("code")).isEqualTo(40101);
    }

    @Test
    void removedSessionEndpoint_doesNotIssueProviderDemoToken() {
        String body = "{\"loginType\":\"MOBILE\",\"mobile\":\"13900139002\",\"verifyCode\":\"654321\",\"role\":\"PROVIDER\"}";
        HttpEntity<String> entity = jsonEntity(body);
        ResponseEntity<Map> resp = rest.exchange("/sessions", HttpMethod.POST, entity, Map.class);

        assertThat(resp.getBody().get("code")).isEqualTo(40101);
    }

    @Test
    void protectedEndpoint_withoutAuth_returns401() {
        ResponseEntity<Map> resp = rest.getForEntity("/users/me", Map.class);
        assertThat(resp.getBody().get("code")).isEqualTo(40101);
    }

    @Test
    void protectedEndpoint_withForgedXUserId_returns401() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-User-Id", "1001");
        ResponseEntity<Map> resp = rest.exchange("/users/me", HttpMethod.GET, new HttpEntity<>(headers), Map.class);

        assertThat(resp.getBody().get("code")).isEqualTo(40101);
    }

    @Test
    void protectedEndpoint_withForgedAdminHeaders_returns401() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-User-Id", "1001");
        headers.set("X-User-Role", "ADMIN");
        ResponseEntity<Map> resp = rest.exchange("/users/me", HttpMethod.GET, new HttpEntity<>(headers), Map.class);

        assertThat(resp.getBody().get("code")).isEqualTo(40101);
    }

    @Test
    void protectedEndpoint_withSignedBearerToken_succeeds() {
        ResponseEntity<Map> resp = rest.exchange(
                "/users/me",
                HttpMethod.GET,
                bearerEntity(1001L, null),
                Map.class
        );

        assertThat(resp.getBody().get("code")).isEqualTo(200);
        assertThat(resp.getBody().get("data")).isNotNull();
    }

    @Test
    void protectedEndpoint_withUnknownXUserId_returns401() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-User-Id", "910003");
        headers.set("X-User-Role", "CUSTOMER");
        headers.setBearerAuth("demo-token-customer-910003");
        ResponseEntity<Map> resp = rest.exchange("/users/me", HttpMethod.GET, new HttpEntity<>(headers), Map.class);

        assertThat(resp.getBody().get("code")).isEqualTo(40101);
    }

    @Test
    void getUserBrief_validId_succeeds() {
        ResponseEntity<Map> resp = rest.exchange(
                "/users/1001/brief",
                HttpMethod.GET,
                bearerEntity(1001L, null),
                Map.class
        );

        assertThat(resp.getBody().get("code")).isEqualTo(200);
        Map<String, Object> data = (Map<String, Object>) resp.getBody().get("data");
        assertThat(((Number) data.get("userId")).longValue()).isEqualTo(1001L);
    }

    @Test
    void switchRole_customerToProvider_succeeds() {
        String body = "{\"role\":\"PROVIDER\"}";
        ResponseEntity<Map> resp = rest.exchange("/users/me/role", HttpMethod.POST,
                bearerEntity(1001L, body), Map.class);

        assertThat(resp.getBody().get("code")).isEqualTo(200);
    }

    private HttpEntity<String> jsonEntity(String body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(body, headers);
    }

    private HttpEntity<String> bearerEntity(Long userId, String body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(jwtUtil.generateToken(userId));
        headers.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(body, headers);
    }
}
