package com.action.camera.account.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public class AccountCancellationCleanupRepository {

    private static final List<String> FINAL_ORDER_STATUSES = List.of(
            "COMPLETED", "CANCELLED", "REFUNDED");

    private final JdbcTemplate jdbcTemplate;

    public AccountCancellationCleanupRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public long countBlockingOrders(Long userId) {
        Long count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM orders
                WHERE (customer_id = ? OR provider_user_id = ?)
                  AND status NOT IN (?, ?, ?)
                """, Long.class, userId, userId,
                FINAL_ORDER_STATUSES.get(0), FINAL_ORDER_STATUSES.get(1), FINAL_ORDER_STATUSES.get(2));
        return count == null ? 0 : count;
    }

    public long countOpenDisputes(Long userId) {
        Long count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM disputes d
                JOIN orders o ON o.id = d.order_id
                WHERE (o.customer_id = ? OR o.provider_user_id = ?)
                  AND d.status <> 'RESOLVED'
                """, Long.class, userId, userId);
        return count == null ? 0 : count;
    }

    /** Lock quotes before checking orders so an already pending agreement cannot be accepted during closure. */
    public void lockParticipantQuotes(Long userId) {
        jdbcTemplate.queryForList("SELECT id FROM quotes WHERE customer_id = ? OR provider_user_id = ? ORDER BY id FOR UPDATE", Long.class, userId, userId);
    }

    public void cleanupUserData(Long userId, String mobileHash, LocalDateTime now) {
        jdbcTemplate.update("UPDATE quotes SET status = 'REJECTED', updated_at = ? WHERE (customer_id = ? OR provider_user_id = ?) AND status = 'PENDING_CONFIRM'", now, userId, userId);
        // Remove public access while retaining business evidence for participants/admins.
        jdbcTemplate.update("UPDATE files SET visibility = 'PRIVATE' WHERE uploader_id = ?", userId);
        jdbcTemplate.update("""
                UPDATE user_sessions SET revoked_at = ?, revoke_reason = 'ACCOUNT_DELETED'
                WHERE user_id = ? AND revoked_at IS NULL
                """, now, userId);
        jdbcTemplate.update("""
                UPDATE user_sessions SET device_id = NULL, device_name = NULL
                WHERE user_id = ?
                """, userId);
        if (mobileHash != null && !mobileHash.isBlank()) {
            jdbcTemplate.update("DELETE FROM sms_challenges WHERE phone_hash = ?", mobileHash);
        }
        jdbcTemplate.update("""
                UPDATE demands SET status = 'CLOSED', hidden_by_customer = true, hidden_at = ?, updated_at = ?
                WHERE customer_id = ?
                """, now, now, userId);
        jdbcTemplate.update("""
                UPDATE service_packages SET status = 'OFFLINE', is_available = false,
                    hidden_by_provider = true, hidden_at = ?, updated_at = ?
                WHERE provider_id = ?
                """, now, now, userId);
        jdbcTemplate.update("""
                UPDATE moment_posts SET status = 'DELETED', deleted_at = ?, updated_at = ?
                WHERE author_id = ?
                """, now, now, userId);

        jdbcTemplate.update("DELETE FROM user_follows WHERE follower_id = ? OR following_user_id = ?",
                userId, userId);
        jdbcTemplate.update("DELETE FROM service_package_interests WHERE user_id = ?", userId);
        jdbcTemplate.update("DELETE FROM moment_likes WHERE user_id = ?", userId);
        jdbcTemplate.update("DELETE FROM moment_favorites WHERE user_id = ?", userId);
        jdbcTemplate.update("DELETE FROM conversation_hidden_by_user WHERE user_id = ?", userId);
        jdbcTemplate.update("DELETE FROM notifications WHERE user_id = ?", userId);
        jdbcTemplate.update("UPDATE notifications SET actor_user_id = NULL WHERE actor_user_id = ?", userId);
        jdbcTemplate.update("""
                UPDATE photo_authorizations
                SET status = 'REVOKED', remark = '账号注销自动撤回公开授权', expire_time = ?
                WHERE (customer_id = ? OR provider_user_id = ?) AND status = 'GRANTED'
                """, now, userId, userId);
        jdbcTemplate.update("DELETE FROM real_name_certifications WHERE user_id = ?", userId);
        jdbcTemplate.update("DELETE FROM student_certifications WHERE user_id = ?", userId);
        jdbcTemplate.update("DELETE FROM user_role_bindings WHERE user_id = ?", userId);

        jdbcTemplate.update("""
                UPDATE provider_profiles
                SET service_type = NULL, display_name = NULL, bio = NULL, city_code = NULL,
                    city_area = NULL, price_min = NULL, price_max = NULL, equipment = NULL,
                    provider_avatar_file_id = NULL, age = NULL,
                    accepting_orders = false, updated_at = ?
                WHERE user_id = ?
                """, now, userId);
    }
}
