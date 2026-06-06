-- V5 fresh init: reviews, review complaints, notifications.
-- Pure CREATE TABLE IF NOT EXISTS — no stored procedures, no UPDATE backfill.
-- Execute as step 5 of Path A (fresh database initialization).
-- For legacy migration from P3, use d_line_backend.sql (Path B) instead.
-- Note: credit_records columns (before_score, after_score, source_type, etc.)
-- are already included in V1_baseline.sql for fresh installs.

CREATE TABLE IF NOT EXISTS reviews (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    reviewer_id BIGINT NOT NULL,
    target_user_id BIGINT NOT NULL,
    direction VARCHAR(40) NOT NULL,
    rating INT NOT NULL,
    content VARCHAR(1000) NULL,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    reply_content VARCHAR(1000) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reply_time DATETIME NULL,
    UNIQUE KEY uk_reviews_order_direction (order_id, direction),
    KEY idx_reviews_target_visible_created (target_user_id, is_visible, created_at),
    KEY idx_reviews_order_created (order_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Order reviews';

CREATE TABLE IF NOT EXISTS review_complaints (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    review_id BIGINT NOT NULL,
    order_id BIGINT NOT NULL,
    complainant_id BIGINT NOT NULL,
    respondent_id BIGINT NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    evidence_file_ids VARCHAR(500) NULL,
    status VARCHAR(30) NOT NULL,
    arbitration_result VARCHAR(30) NULL,
    arbitration_comment VARCHAR(1000) NULL,
    handled_by BIGINT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    handled_at DATETIME NULL,
    KEY idx_review_complaints_review_status (review_id, status),
    KEY idx_review_complaints_complainant_status (complainant_id, status),
    KEY idx_review_complaints_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Review complaints';

CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    actor_user_id BIGINT NULL,
    title VARCHAR(255) NOT NULL,
    content VARCHAR(1000) NOT NULL,
    type VARCHAR(60) NOT NULL,
    event_type VARCHAR(60) NULL,
    related_type VARCHAR(40) NULL,
    related_id BIGINT NULL,
    target_type VARCHAR(40) NULL,
    target_id BIGINT NULL,
    source_type VARCHAR(40) NULL,
    source_id BIGINT NULL,
    dedupe_key VARCHAR(160) NULL,
    metadata_json TEXT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_notifications_dedupe (dedupe_key),
    KEY idx_notifications_user_read_created (user_id, is_read, created_at),
    KEY idx_notifications_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Unified business notifications';
