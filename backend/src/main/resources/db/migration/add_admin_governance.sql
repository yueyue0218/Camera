-- Administrator governance persistence for MySQL 8.0+.
-- Repeatable migration: every legacy content column and index is guarded by
-- information_schema before the prepared ALTER statement is executed.

SET @schema_name = DATABASE();

SET @sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE demands ADD COLUMN moderation_status VARCHAR(20) NOT NULL DEFAULT ''VISIBLE''',
        'SELECT ''demands.moderation_status already exists'' AS message')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'demands' AND COLUMN_NAME = 'moderation_status'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE demands ADD COLUMN moderated_by BIGINT NULL',
        'SELECT ''demands.moderated_by already exists'' AS message')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'demands' AND COLUMN_NAME = 'moderated_by'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE demands ADD COLUMN moderated_at DATETIME NULL',
        'SELECT ''demands.moderated_at already exists'' AS message')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'demands' AND COLUMN_NAME = 'moderated_at'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE demands ADD COLUMN moderation_reason VARCHAR(500) NULL',
        'SELECT ''demands.moderation_reason already exists'' AS message')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'demands' AND COLUMN_NAME = 'moderation_reason'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE service_packages ADD COLUMN moderation_status VARCHAR(20) NOT NULL DEFAULT ''VISIBLE''',
        'SELECT ''service_packages.moderation_status already exists'' AS message')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'service_packages' AND COLUMN_NAME = 'moderation_status'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE service_packages ADD COLUMN moderated_by BIGINT NULL',
        'SELECT ''service_packages.moderated_by already exists'' AS message')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'service_packages' AND COLUMN_NAME = 'moderated_by'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE service_packages ADD COLUMN moderated_at DATETIME NULL',
        'SELECT ''service_packages.moderated_at already exists'' AS message')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'service_packages' AND COLUMN_NAME = 'moderated_at'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE service_packages ADD COLUMN moderation_reason VARCHAR(500) NULL',
        'SELECT ''service_packages.moderation_reason already exists'' AS message')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'service_packages' AND COLUMN_NAME = 'moderation_reason'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE moment_posts ADD COLUMN moderation_status VARCHAR(20) NOT NULL DEFAULT ''VISIBLE''',
        'SELECT ''moment_posts.moderation_status already exists'' AS message')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'moment_posts' AND COLUMN_NAME = 'moderation_status'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE moment_posts ADD COLUMN moderated_by BIGINT NULL',
        'SELECT ''moment_posts.moderated_by already exists'' AS message')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'moment_posts' AND COLUMN_NAME = 'moderated_by'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE moment_posts ADD COLUMN moderated_at DATETIME NULL',
        'SELECT ''moment_posts.moderated_at already exists'' AS message')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'moment_posts' AND COLUMN_NAME = 'moderated_at'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE moment_posts ADD COLUMN moderation_reason VARCHAR(500) NULL',
        'SELECT ''moment_posts.moderation_reason already exists'' AS message')
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'moment_posts' AND COLUMN_NAME = 'moderation_reason'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(COUNT(*) = 0,
        'CREATE INDEX idx_demands_moderation_public ON demands (moderation_status, status, created_at)',
        'SELECT ''idx_demands_moderation_public already exists'' AS message')
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'demands' AND INDEX_NAME = 'idx_demands_moderation_public'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(COUNT(*) = 0,
        'CREATE INDEX idx_service_packages_moderation_public ON service_packages (moderation_status, status, created_at)',
        'SELECT ''idx_service_packages_moderation_public already exists'' AS message')
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'service_packages' AND INDEX_NAME = 'idx_service_packages_moderation_public'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(COUNT(*) = 0,
        'CREATE INDEX idx_moment_posts_moderation_public ON moment_posts (moderation_status, status, created_at)',
        'SELECT ''idx_moment_posts_moderation_public already exists'' AS message')
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'moment_posts' AND INDEX_NAME = 'idx_moment_posts_moderation_public'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS reports (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    reporter_id BIGINT NOT NULL,
    target_type VARCHAR(30) NOT NULL,
    target_id BIGINT NOT NULL,
    reason VARCHAR(500) NOT NULL,
    description VARCHAR(1000) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    admin_id BIGINT NULL,
    resolution VARCHAR(30) NULL,
    admin_comment VARCHAR(1000) NULL,
    active_dedupe_key VARCHAR(160) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    resolved_at DATETIME NULL,
    UNIQUE KEY uk_reports_active_dedupe (active_dedupe_key),
    KEY idx_reports_status_created (status, created_at),
    KEY idx_reports_target_status (target_type, target_id, status),
    KEY idx_reports_reporter_created (reporter_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Platform content and user reports';
