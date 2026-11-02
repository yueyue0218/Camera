package com.action.camera.account;

import com.action.camera.account.repository.AccountCancellationCleanupRepository;
import com.action.camera.domain.User;
import com.action.camera.domain.UserRoleBinding;
import com.action.camera.repository.UserRepository;
import com.action.camera.repository.UserRoleBindingRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = "spring.http.client.factory=simple")
@ActiveProfiles("smoke")
class AccountCancellationCleanupRepositoryTest {

    @Autowired
    private AccountCancellationCleanupRepository cleanupRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private UserRoleBindingRepository userRoleBindingRepository;
    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @Timeout(20)
    void cleanupRevokesSessionsAndRemovesIdentityFacingData() {
        User user = new User();
        user.setNickname("cleanup-target");
        user.setCurrentRole("PROVIDER");
        user.setStatus("ACTIVE");
        user = userRepository.saveAndFlush(user);
        Long userId = user.getId();

        UserRoleBinding binding = new UserRoleBinding();
        binding.setUserId(userId);
        binding.setRole("PROVIDER");
        userRoleBindingRepository.saveAndFlush(binding);
        jdbcTemplate.update("""
                INSERT INTO user_sessions
                    (user_id, session_id, refresh_token_hash, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?)
                """, userId, "delete-session-" + userId,
                String.format("%064d", userId), LocalDateTime.now(), LocalDateTime.now().plusDays(30));
        jdbcTemplate.update("""
                INSERT INTO provider_profiles
                    (user_id, display_name, bio, accepting_orders, created_at, updated_at)
                VALUES (?, ?, ?, true, ?, ?)
                """, userId, "公开摄影师", "公开简介", LocalDateTime.now(), LocalDateTime.now());

        cleanupRepository.cleanupUserData(userId, null, LocalDateTime.now());

        assertThat(userRoleBindingRepository.existsByUserIdAndRole(userId, "PROVIDER")).isFalse();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT revoked_at IS NOT NULL FROM user_sessions WHERE user_id = ?",
                Boolean.class, userId)).isTrue();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT revoke_reason FROM user_sessions WHERE user_id = ?",
                String.class, userId)).isEqualTo("ACCOUNT_DELETED");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT display_name IS NULL AND bio IS NULL AND accepting_orders = false "
                        + "FROM provider_profiles WHERE user_id = ?",
                Boolean.class, userId)).isTrue();
    }
}
