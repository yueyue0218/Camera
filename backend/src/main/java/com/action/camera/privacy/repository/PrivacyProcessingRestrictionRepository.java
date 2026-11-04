package com.action.camera.privacy.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;

/** Stops public dissemination while preserving participant-only evidence and the account. */
@Repository
public class PrivacyProcessingRestrictionRepository {
    private final JdbcTemplate jdbc;
    public PrivacyProcessingRestrictionRepository(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public void restrict(Long userId,LocalDateTime now) {
        jdbc.update("UPDATE demands SET status='CLOSED', hidden_by_customer=true, hidden_at=?, updated_at=? WHERE customer_id=?",now,now,userId);
        jdbc.update("UPDATE service_packages SET status='OFFLINE', is_available=false, hidden_by_provider=true, hidden_at=?, updated_at=? WHERE provider_id=?",now,now,userId);
        jdbc.update("UPDATE moment_posts SET moderation_status='HIDDEN', moderation_reason='出境授权已撤回，限制公开处理', moderated_at=?, updated_at=? WHERE author_id=? AND moderation_status='VISIBLE'",now,now,userId);
        jdbc.update("UPDATE files SET visibility='PRIVATE' WHERE uploader_id=? AND visibility='PUBLIC'",userId);
        jdbc.update("UPDATE users SET gender_visible=false,birthday_visible=false,location_visible=false WHERE id=?",userId);
        jdbc.update("UPDATE provider_profiles SET accepting_orders=false,updated_at=? WHERE user_id=?",now,userId);
    }
}
