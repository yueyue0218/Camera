-- Align a P3/history database with the schema contract currently declared by Path A.
-- MySQL 8.0+. Execute only after every earlier Path B migration.
--
-- Safety rules:
--   * no business-row backfill is performed;
--   * narrowing conversions and nullable-to-required conversions are preflighted;
--   * any incompatible row aborts the migration with SQLSTATE 45000;
--   * disputes.previous_order_status intentionally remains nullable until its
--     separately documented second-stage hardening gate is approved.

DELIMITER $$

DROP PROCEDURE IF EXISTS schema_sync_assert_max_length$$
CREATE PROCEDURE schema_sync_assert_max_length(
    IN p_table_name VARCHAR(64),
    IN p_column_name VARCHAR(64),
    IN p_max_length INT
)
BEGIN
    DECLARE v_violations BIGINT DEFAULT 0;
    DECLARE v_message VARCHAR(255);

    SET @schema_sync_sql = CONCAT(
        'SELECT COUNT(*) INTO @schema_sync_violation_count FROM `',
        p_table_name,
        '` WHERE `',
        p_column_name,
        '` IS NOT NULL AND CHAR_LENGTH(`',
        p_column_name,
        '`) > ',
        p_max_length
    );
    PREPARE schema_sync_stmt FROM @schema_sync_sql;
    EXECUTE schema_sync_stmt;
    DEALLOCATE PREPARE schema_sync_stmt;
    SET v_violations = COALESCE(@schema_sync_violation_count, 0);

    IF v_violations > 0 THEN
        SET v_message = CONCAT(
            'SCHEMA SYNC BLOCKED: ',
            p_table_name,
            '.',
            p_column_name,
            ' exceeds ',
            p_max_length
        );
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_message;
    END IF;
END$$

DROP PROCEDURE IF EXISTS schema_sync_assert_no_nulls$$
CREATE PROCEDURE schema_sync_assert_no_nulls(
    IN p_table_name VARCHAR(64),
    IN p_column_name VARCHAR(64)
)
BEGIN
    DECLARE v_violations BIGINT DEFAULT 0;
    DECLARE v_message VARCHAR(255);

    SET @schema_sync_sql = CONCAT(
        'SELECT COUNT(*) INTO @schema_sync_violation_count FROM `',
        p_table_name,
        '` WHERE `',
        p_column_name,
        '` IS NULL'
    );
    PREPARE schema_sync_stmt FROM @schema_sync_sql;
    EXECUTE schema_sync_stmt;
    DEALLOCATE PREPARE schema_sync_stmt;
    SET v_violations = COALESCE(@schema_sync_violation_count, 0);

    IF v_violations > 0 THEN
        SET v_message = CONCAT(
            'SCHEMA SYNC BLOCKED: ',
            p_table_name,
            '.',
            p_column_name,
            ' contains NULL'
        );
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_message;
    END IF;
END$$

DROP PROCEDURE IF EXISTS schema_sync_add_index_if_missing$$
CREATE PROCEDURE schema_sync_add_index_if_missing(
    IN p_table_name VARCHAR(64),
    IN p_index_name VARCHAR(64),
    IN p_index_columns VARCHAR(255)
)
BEGIN
    DECLARE v_exists INT DEFAULT 0;

    SELECT COUNT(*)
      INTO v_exists
      FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = p_table_name
       AND index_name = p_index_name;

    IF v_exists = 0 THEN
        SET @schema_sync_sql = CONCAT(
            'ALTER TABLE `',
            p_table_name,
            '` ADD INDEX `',
            p_index_name,
            '` ',
            p_index_columns
        );
        PREPARE schema_sync_stmt FROM @schema_sync_sql;
        EXECUTE schema_sync_stmt;
        DEALLOCATE PREPARE schema_sync_stmt;
    END IF;
END$$

DELIMITER ;

-- Guard every narrowing conversion before changing definitions.
CALL schema_sync_assert_max_length('credit_records', 'reason', 1000);
CALL schema_sync_assert_max_length('dispute_replies', 'content', 2000);
CALL schema_sync_assert_max_length('disputes', 'reason', 1000);
CALL schema_sync_assert_max_length('disputes', 'status', 20);
CALL schema_sync_assert_max_length('disputes', 'resolution', 30);
CALL schema_sync_assert_max_length('notifications', 'content', 1000);
CALL schema_sync_assert_max_length('provider_profiles', 'bio', 500);
CALL schema_sync_assert_max_length('provider_profiles', 'city_area', 100);
CALL schema_sync_assert_max_length('provider_profiles', 'audit_status', 20);
CALL schema_sync_assert_max_length('real_name_certifications', 'status', 20);
CALL schema_sync_assert_max_length('reviews', 'content', 1000);
CALL schema_sync_assert_max_length('reviews', 'reply_content', 1000);

-- Guard nullable-to-required conversions. The script never invents replacement data.
CALL schema_sync_assert_no_nulls('disputes', 'initiator_id');
CALL schema_sync_assert_no_nulls('disputes', 'reason');
CALL schema_sync_assert_no_nulls('disputes', 'created_at');
CALL schema_sync_assert_no_nulls('disputes', 'updated_at');
CALL schema_sync_assert_no_nulls('service_packages', 'provider_id');
CALL schema_sync_assert_no_nulls('service_packages', 'base_price_cent');

ALTER TABLE credit_records
    MODIFY COLUMN reason VARCHAR(1000) NULL;

ALTER TABLE deliveries
    MODIFY COLUMN original_count INT NULL,
    MODIFY COLUMN refined_count INT NULL,
    MODIFY COLUMN deadline DATETIME NULL,
    MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'PENDING_UPLOAD',
    MODIFY COLUMN upload_time DATETIME NULL;

ALTER TABLE delivery_files
    MODIFY COLUMN file_type VARCHAR(30) NULL,
    MODIFY COLUMN upload_time DATETIME NULL;

ALTER TABLE dispute_replies
    MODIFY COLUMN content VARCHAR(2000) NOT NULL;

ALTER TABLE disputes
    MODIFY COLUMN initiator_id BIGINT NOT NULL,
    MODIFY COLUMN reason VARCHAR(1000) NOT NULL,
    MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    MODIFY COLUMN resolution VARCHAR(30) NULL,
    MODIFY COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    MODIFY COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE files
    MODIFY COLUMN checksum VARCHAR(64) NULL;

ALTER TABLE notifications
    MODIFY COLUMN content VARCHAR(1000) NOT NULL;

ALTER TABLE orders
    MODIFY COLUMN shoot_location VARCHAR(500) NOT NULL,
    MODIFY COLUMN photo_usage_scope VARCHAR(60) NOT NULL DEFAULT 'PERSONAL_ONLY';

ALTER TABLE payment_records
    MODIFY COLUMN status VARCHAR(30) NOT NULL;

ALTER TABLE photo_authorizations
    MODIFY COLUMN photo_usage_scope VARCHAR(60) NOT NULL DEFAULT 'PORTFOLIO_DISPLAY',
    MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    MODIFY COLUMN authorized_at DATETIME NULL;

ALTER TABLE provider_profiles
    MODIFY COLUMN service_type VARCHAR(40) NULL,
    MODIFY COLUMN display_name VARCHAR(100) NULL,
    MODIFY COLUMN bio VARCHAR(500) NULL,
    MODIFY COLUMN city_code VARCHAR(32) NULL,
    MODIFY COLUMN city_area VARCHAR(100) NULL,
    MODIFY COLUMN accepting_orders BOOLEAN NOT NULL DEFAULT TRUE,
    MODIFY COLUMN avg_rating DECIMAL(3,2) NULL,
    MODIFY COLUMN audit_status VARCHAR(20) NOT NULL DEFAULT 'PENDING';

ALTER TABLE quotes
    MODIFY COLUMN location VARCHAR(500) NOT NULL,
    MODIFY COLUMN original_count INT NOT NULL DEFAULT 0,
    MODIFY COLUMN refined_count INT NOT NULL DEFAULT 0;

ALTER TABLE real_name_certifications
    MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    MODIFY COLUMN reject_reason VARCHAR(500) NULL;

ALTER TABLE review_complaints
    MODIFY COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    MODIFY COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    MODIFY COLUMN handled_at DATETIME NULL;

ALTER TABLE reviews
    MODIFY COLUMN content VARCHAR(1000) NULL,
    MODIFY COLUMN reply_content VARCHAR(1000) NULL;

ALTER TABLE service_packages
    MODIFY COLUMN provider_id BIGINT NOT NULL,
    MODIFY COLUMN base_price_cent BIGINT NOT NULL,
    MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'ONLINE';

ALTER TABLE student_certifications
    MODIFY COLUMN student_no_hash VARCHAR(64) NULL;

ALTER TABLE users
    MODIFY COLUMN credit_score DECIMAL(5,2) NULL DEFAULT NULL;

CALL schema_sync_add_index_if_missing(
    'demand_responses',
    'idx_demand_responses_current',
    '(demand_id, status, response_time)'
);
CALL schema_sync_add_index_if_missing(
    'disputes',
    'idx_disputes_initiator_status',
    '(initiator_id, status)'
);
CALL schema_sync_add_index_if_missing(
    'disputes',
    'idx_disputes_status_created',
    '(status, created_at)'
);
CALL schema_sync_add_index_if_missing(
    'orders',
    'idx_orders_status_created',
    '(status, created_at)'
);
CALL schema_sync_add_index_if_missing(
    'payment_records',
    'idx_payment_records_status',
    '(status)'
);
CALL schema_sync_add_index_if_missing(
    'photo_authorizations',
    'idx_photo_auth_provider_status',
    '(provider_user_id, status)'
);
CALL schema_sync_add_index_if_missing(
    'users',
    'idx_users_status',
    '(status)'
);

DROP PROCEDURE IF EXISTS schema_sync_assert_max_length;
DROP PROCEDURE IF EXISTS schema_sync_assert_no_nulls;
DROP PROCEDURE IF EXISTS schema_sync_add_index_if_missing;
