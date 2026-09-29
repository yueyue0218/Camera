package com.action.camera.social;

import com.action.camera.support.TestAuthTokens;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.MOCK,
        properties = {
                "spring.http.client.factory=simple",
                "spring.datasource.url=jdbc:h2:mem:profile_social_http;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;NON_KEYWORDS=CURRENT_ROLE;DB_CLOSE_DELAY=-1",
                "spring.jpa.properties.hibernate.generate_statistics=true"
        })
@AutoConfigureMockMvc
class SocialRelationHttpSqlTest {

    private static final long VIEWER_ID = 981000L;
    private static final long TARGET_ID = 981001L;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private TestAuthTokens testAuthTokens;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    private Statistics statistics;
    private String bearerToken;

    @BeforeEach
    void setUp() {
        insertUser(VIEWER_ID, "viewer", "CUSTOMER");
        insertUser(TARGET_ID, "target", "PROVIDER");
        LocalDateTime createdAt = LocalDateTime.of(2026, 9, 19, 10, 0);
        for (int index = 0; index < 12; index++) {
            long customerId = 981100L + index;
            long providerId = 981200L + index;
            long followerId = 981300L + index;
            insertUser(customerId, "customer-" + index, "CUSTOMER");
            insertUser(providerId, "provider-" + index, "PROVIDER");
            insertUser(followerId, "follower-" + index, index % 2 == 0 ? "CUSTOMER" : "PROVIDER");
            insertFollow(VIEWER_ID, customerId, "CUSTOMER", createdAt.plusMinutes(index));
            insertFollow(VIEWER_ID, providerId, "PROVIDER", createdAt.plusHours(1).plusMinutes(index));
            insertFollow(followerId, TARGET_ID, "PROVIDER", createdAt.plusHours(2).plusMinutes(index));
        }
        bearerToken = testAuthTokens.generateToken(VIEWER_ID);
        statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);
    }

    @Test
    void twelveUserSocialHttpRequestsStayWithinEightStatementsIncludingAuthentication() throws Exception {
        long followersSql = measure("/users/" + TARGET_ID + "/followers", "PROVIDER");
        long followingCustomersSql = measure("/users/" + VIEWER_ID + "/following", "CUSTOMER");
        long followingProvidersSql = measure("/users/" + VIEWER_ID + "/following", "PROVIDER");

        assertThat(followersSql).as("followers SQL including authentication").isLessThanOrEqualTo(8);
        assertThat(followingCustomersSql).as("customer following SQL including authentication").isLessThanOrEqualTo(8);
        assertThat(followingProvidersSql).as("provider following SQL including authentication").isLessThanOrEqualTo(8);
        System.out.printf(
                "PROFILE_SOCIAL_AFTER cards=12 followersSql=%d followingCustomerSql=%d followingProviderSql=%d%n",
                followersSql, followingCustomersSql, followingProvidersSql);
    }

    private long measure(String path, String role) throws Exception {
        entityManager.clear();
        statistics.clear();
        mockMvc.perform(get(path)
                        .param("role", role)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + bearerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.length()").value(12));
        return statistics.getPrepareStatementCount();
    }

    private void insertUser(long userId, String nickname, String role) {
        jdbcTemplate.update("""
                INSERT INTO users (id, nickname, current_role, bio, status, credit_score, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'ACTIVE', 80.00, NOW(), NOW())
                """, userId, nickname, role, nickname + " bio");
    }

    private void insertFollow(long followerId, long followingUserId, String targetRole, LocalDateTime createdAt) {
        jdbcTemplate.update("""
                INSERT INTO user_follows (follower_id, following_user_id, target_role, created_at)
                VALUES (?, ?, ?, ?)
                """, followerId, followingUserId, targetRole, createdAt);
    }
}
