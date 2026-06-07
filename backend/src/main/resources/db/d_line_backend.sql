-- D-line backend persistence migration.
-- Covers review, review complaint, credit, and notification integrity fields.

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

DELIMITER //

DROP PROCEDURE IF EXISTS dline_add_column_if_missing//
CREATE PROCEDURE dline_add_column_if_missing(
    IN p_table_name VARCHAR(64),
    IN p_column_name VARCHAR(64),
    IN p_column_definition TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = p_table_name
          AND column_name = p_column_name
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', p_table_name, '` ADD COLUMN ', p_column_definition);
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END//

DROP PROCEDURE IF EXISTS dline_add_index_if_missing//
CREATE PROCEDURE dline_add_index_if_missing(
    IN p_table_name VARCHAR(64),
    IN p_index_name VARCHAR(64),
    IN p_index_definition TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = p_table_name
          AND index_name = p_index_name
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', p_table_name, '` ADD ', p_index_definition);
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END//

DELIMITER ;

CALL dline_add_column_if_missing('credit_records', 'before_score', 'before_score DECIMAL(5,2) NULL');
CALL dline_add_column_if_missing('credit_records', 'after_score', 'after_score DECIMAL(5,2) NULL');
CALL dline_add_column_if_missing('credit_records', 'applied_score_change', 'applied_score_change INT NULL');
CALL dline_add_column_if_missing('credit_records', 'source_type', 'source_type VARCHAR(40) NULL');
CALL dline_add_column_if_missing('credit_records', 'source_id', 'source_id BIGINT NULL');
CALL dline_add_index_if_missing('credit_records', 'uk_credit_records_source', 'UNIQUE KEY uk_credit_records_source (source_type, source_id)');
CALL dline_add_index_if_missing('credit_records', 'idx_credit_records_user_created', 'INDEX idx_credit_records_user_created (user_id, created_at)');

CALL dline_add_index_if_missing('reviews', 'uk_reviews_order_direction', 'UNIQUE KEY uk_reviews_order_direction (order_id, direction)');
CALL dline_add_index_if_missing('reviews', 'idx_reviews_target_visible_created', 'INDEX idx_reviews_target_visible_created (target_user_id, is_visible, created_at)');
CALL dline_add_index_if_missing('review_complaints', 'idx_review_complaints_review_status', 'INDEX idx_review_complaints_review_status (review_id, status)');
CALL dline_add_index_if_missing('review_complaints', 'idx_review_complaints_complainant_status', 'INDEX idx_review_complaints_complainant_status (complainant_id, status)');

CALL dline_add_column_if_missing('notifications', 'actor_user_id', 'actor_user_id BIGINT NULL');
CALL dline_add_column_if_missing('notifications', 'event_type', 'event_type VARCHAR(60) NULL');
CALL dline_add_column_if_missing('notifications', 'target_type', 'target_type VARCHAR(40) NULL');
CALL dline_add_column_if_missing('notifications', 'target_id', 'target_id BIGINT NULL');
CALL dline_add_column_if_missing('notifications', 'source_type', 'source_type VARCHAR(40) NULL');
CALL dline_add_column_if_missing('notifications', 'source_id', 'source_id BIGINT NULL');
CALL dline_add_column_if_missing('notifications', 'dedupe_key', 'dedupe_key VARCHAR(160) NULL');
CALL dline_add_column_if_missing('notifications', 'metadata_json', 'metadata_json TEXT NULL');
CALL dline_add_index_if_missing('notifications', 'uk_notifications_dedupe', 'UNIQUE KEY uk_notifications_dedupe (dedupe_key)');
CALL dline_add_index_if_missing('notifications', 'idx_notifications_user_read_created', 'INDEX idx_notifications_user_read_created (user_id, is_read, created_at)');
CALL dline_add_index_if_missing('notifications', 'idx_notifications_target', 'INDEX idx_notifications_target (target_type, target_id)');

UPDATE credit_records
SET before_score = COALESCE(before_score, score_after - score_change),
    after_score = COALESCE(after_score, score_after),
    applied_score_change = COALESCE(applied_score_change, score_change)
WHERE before_score IS NULL
   OR after_score IS NULL
   OR applied_score_change IS NULL;

UPDATE notifications
SET event_type = COALESCE(event_type, type),
    target_type = COALESCE(target_type, related_type),
    target_id = COALESCE(target_id, related_id),
    source_type = COALESCE(source_type, related_type),
    source_id = COALESCE(source_id, related_id)
WHERE event_type IS NULL
   OR target_type IS NULL
   OR target_id IS NULL
   OR source_type IS NULL
   OR source_id IS NULL;

DROP PROCEDURE IF EXISTS dline_add_index_if_missing;
DROP PROCEDURE IF EXISTS dline_add_column_if_missing;
