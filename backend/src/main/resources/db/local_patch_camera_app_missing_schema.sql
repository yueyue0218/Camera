-- Local-only patch for camera_app schema gaps.
-- Sources:
--   backend/src/main/resources/db/conversations_messages.sql
--   backend/src/main/resources/db/d_line_backend.sql
--
-- Scope:
--   1. Create missing conversation_hidden_by_user table.
--   2. Add missing credit_records columns and indexes.
--   3. Add missing notifications columns and indexes.
--   4. Add missing reviews and review_complaints indexes.
--
-- Execute this script only after selecting the camera_app database.

CREATE TABLE IF NOT EXISTS conversation_hidden_by_user (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    conversation_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    hidden_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_conversation_hidden_user (conversation_id, user_id),
    KEY idx_conversation_hidden_user (user_id, hidden_at),
    KEY idx_conversation_hidden_conversation (conversation_id),
    CONSTRAINT fk_conversation_hidden_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    CONSTRAINT fk_conversation_hidden_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='User-scoped hidden conversations';

SET @ddl = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `credit_records` ADD COLUMN `before_score` DECIMAL(5,2) NULL',
        'SELECT ''credit_records.before_score already exists'''
    )
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'credit_records'
      AND column_name = 'before_score'
);
PREPARE local_patch_stmt FROM @ddl;
EXECUTE local_patch_stmt;
DEALLOCATE PREPARE local_patch_stmt;

SET @ddl = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `credit_records` ADD COLUMN `after_score` DECIMAL(5,2) NULL',
        'SELECT ''credit_records.after_score already exists'''
    )
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'credit_records'
      AND column_name = 'after_score'
);
PREPARE local_patch_stmt FROM @ddl;
EXECUTE local_patch_stmt;
DEALLOCATE PREPARE local_patch_stmt;

SET @ddl = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `credit_records` ADD COLUMN `applied_score_change` INT NULL',
        'SELECT ''credit_records.applied_score_change already exists'''
    )
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'credit_records'
      AND column_name = 'applied_score_change'
);
PREPARE local_patch_stmt FROM @ddl;
EXECUTE local_patch_stmt;
DEALLOCATE PREPARE local_patch_stmt;

SET @ddl = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `credit_records` ADD COLUMN `source_type` VARCHAR(40) NULL',
        'SELECT ''credit_records.source_type already exists'''
    )
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'credit_records'
      AND column_name = 'source_type'
);
PREPARE local_patch_stmt FROM @ddl;
EXECUTE local_patch_stmt;
DEALLOCATE PREPARE local_patch_stmt;

SET @ddl = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `credit_records` ADD COLUMN `source_id` BIGINT NULL',
        'SELECT ''credit_records.source_id already exists'''
    )
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'credit_records'
      AND column_name = 'source_id'
);
PREPARE local_patch_stmt FROM @ddl;
EXECUTE local_patch_stmt;
DEALLOCATE PREPARE local_patch_stmt;

SET @ddl = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `credit_records` ADD UNIQUE KEY `uk_credit_records_source` (`source_type`, `source_id`)',
        'SELECT ''credit_records.uk_credit_records_source already exists'''
    )
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'credit_records'
      AND index_name = 'uk_credit_records_source'
);
PREPARE local_patch_stmt FROM @ddl;
EXECUTE local_patch_stmt;
DEALLOCATE PREPARE local_patch_stmt;

SET @ddl = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `credit_records` ADD INDEX `idx_credit_records_user_created` (`user_id`, `created_at`)',
        'SELECT ''credit_records.idx_credit_records_user_created already exists'''
    )
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'credit_records'
      AND index_name = 'idx_credit_records_user_created'
);
PREPARE local_patch_stmt FROM @ddl;
EXECUTE local_patch_stmt;
DEALLOCATE PREPARE local_patch_stmt;

SET @ddl = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `notifications` ADD COLUMN `actor_user_id` BIGINT NULL',
        'SELECT ''notifications.actor_user_id already exists'''
    )
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'notifications'
      AND column_name = 'actor_user_id'
);
PREPARE local_patch_stmt FROM @ddl;
EXECUTE local_patch_stmt;
DEALLOCATE PREPARE local_patch_stmt;

SET @ddl = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `notifications` ADD COLUMN `event_type` VARCHAR(60) NULL',
        'SELECT ''notifications.event_type already exists'''
    )
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'notifications'
      AND column_name = 'event_type'
);
PREPARE local_patch_stmt FROM @ddl;
EXECUTE local_patch_stmt;
DEALLOCATE PREPARE local_patch_stmt;

SET @ddl = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `notifications` ADD COLUMN `target_type` VARCHAR(40) NULL',
        'SELECT ''notifications.target_type already exists'''
    )
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'notifications'
      AND column_name = 'target_type'
);
PREPARE local_patch_stmt FROM @ddl;
EXECUTE local_patch_stmt;
DEALLOCATE PREPARE local_patch_stmt;

SET @ddl = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `notifications` ADD COLUMN `target_id` BIGINT NULL',
        'SELECT ''notifications.target_id already exists'''
    )
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'notifications'
      AND column_name = 'target_id'
);
PREPARE local_patch_stmt FROM @ddl;
EXECUTE local_patch_stmt;
DEALLOCATE PREPARE local_patch_stmt;

SET @ddl = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `notifications` ADD COLUMN `source_type` VARCHAR(40) NULL',
        'SELECT ''notifications.source_type already exists'''
    )
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'notifications'
      AND column_name = 'source_type'
);
PREPARE local_patch_stmt FROM @ddl;
EXECUTE local_patch_stmt;
DEALLOCATE PREPARE local_patch_stmt;

SET @ddl = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `notifications` ADD COLUMN `source_id` BIGINT NULL',
        'SELECT ''notifications.source_id already exists'''
    )
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'notifications'
      AND column_name = 'source_id'
);
PREPARE local_patch_stmt FROM @ddl;
EXECUTE local_patch_stmt;
DEALLOCATE PREPARE local_patch_stmt;

SET @ddl = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `notifications` ADD COLUMN `dedupe_key` VARCHAR(160) NULL',
        'SELECT ''notifications.dedupe_key already exists'''
    )
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'notifications'
      AND column_name = 'dedupe_key'
);
PREPARE local_patch_stmt FROM @ddl;
EXECUTE local_patch_stmt;
DEALLOCATE PREPARE local_patch_stmt;

SET @ddl = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `notifications` ADD COLUMN `metadata_json` TEXT NULL',
        'SELECT ''notifications.metadata_json already exists'''
    )
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'notifications'
      AND column_name = 'metadata_json'
);
PREPARE local_patch_stmt FROM @ddl;
EXECUTE local_patch_stmt;
DEALLOCATE PREPARE local_patch_stmt;

SET @ddl = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `notifications` ADD UNIQUE KEY `uk_notifications_dedupe` (`dedupe_key`)',
        'SELECT ''notifications.uk_notifications_dedupe already exists'''
    )
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'notifications'
      AND index_name = 'uk_notifications_dedupe'
);
PREPARE local_patch_stmt FROM @ddl;
EXECUTE local_patch_stmt;
DEALLOCATE PREPARE local_patch_stmt;

SET @ddl = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `notifications` ADD INDEX `idx_notifications_user_read_created` (`user_id`, `is_read`, `created_at`)',
        'SELECT ''notifications.idx_notifications_user_read_created already exists'''
    )
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'notifications'
      AND index_name = 'idx_notifications_user_read_created'
);
PREPARE local_patch_stmt FROM @ddl;
EXECUTE local_patch_stmt;
DEALLOCATE PREPARE local_patch_stmt;

SET @ddl = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `notifications` ADD INDEX `idx_notifications_target` (`target_type`, `target_id`)',
        'SELECT ''notifications.idx_notifications_target already exists'''
    )
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'notifications'
      AND index_name = 'idx_notifications_target'
);
PREPARE local_patch_stmt FROM @ddl;
EXECUTE local_patch_stmt;
DEALLOCATE PREPARE local_patch_stmt;

SET @ddl = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `reviews` ADD UNIQUE KEY `uk_reviews_order_direction` (`order_id`, `direction`)',
        'SELECT ''reviews.uk_reviews_order_direction already exists'''
    )
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'reviews'
      AND index_name = 'uk_reviews_order_direction'
);
PREPARE local_patch_stmt FROM @ddl;
EXECUTE local_patch_stmt;
DEALLOCATE PREPARE local_patch_stmt;

SET @ddl = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `reviews` ADD INDEX `idx_reviews_target_visible_created` (`target_user_id`, `is_visible`, `created_at`)',
        'SELECT ''reviews.idx_reviews_target_visible_created already exists'''
    )
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'reviews'
      AND index_name = 'idx_reviews_target_visible_created'
);
PREPARE local_patch_stmt FROM @ddl;
EXECUTE local_patch_stmt;
DEALLOCATE PREPARE local_patch_stmt;

SET @ddl = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `reviews` ADD INDEX `idx_reviews_order_created` (`order_id`, `created_at`)',
        'SELECT ''reviews.idx_reviews_order_created already exists'''
    )
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'reviews'
      AND index_name = 'idx_reviews_order_created'
);
PREPARE local_patch_stmt FROM @ddl;
EXECUTE local_patch_stmt;
DEALLOCATE PREPARE local_patch_stmt;

SET @ddl = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `review_complaints` ADD INDEX `idx_review_complaints_review_status` (`review_id`, `status`)',
        'SELECT ''review_complaints.idx_review_complaints_review_status already exists'''
    )
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'review_complaints'
      AND index_name = 'idx_review_complaints_review_status'
);
PREPARE local_patch_stmt FROM @ddl;
EXECUTE local_patch_stmt;
DEALLOCATE PREPARE local_patch_stmt;

SET @ddl = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `review_complaints` ADD INDEX `idx_review_complaints_complainant_status` (`complainant_id`, `status`)',
        'SELECT ''review_complaints.idx_review_complaints_complainant_status already exists'''
    )
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'review_complaints'
      AND index_name = 'idx_review_complaints_complainant_status'
);
PREPARE local_patch_stmt FROM @ddl;
EXECUTE local_patch_stmt;
DEALLOCATE PREPARE local_patch_stmt;

SET @ddl = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE `review_complaints` ADD INDEX `idx_review_complaints_status_created` (`status`, `created_at`)',
        'SELECT ''review_complaints.idx_review_complaints_status_created already exists'''
    )
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'review_complaints'
      AND index_name = 'idx_review_complaints_status_created'
);
PREPARE local_patch_stmt FROM @ddl;
EXECUTE local_patch_stmt;
DEALLOCATE PREPARE local_patch_stmt;

SET @ddl = NULL;
