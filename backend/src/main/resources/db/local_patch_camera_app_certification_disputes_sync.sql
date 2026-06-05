-- Local-only patch for camera_app certification, audit, dispute, and notification schema drift.
--
-- Preconditions:
--   1. Back up camera_app with mysqldump before running this script.
--   2. Run backend/src/main/resources/db/local_patch_camera_app_missing_schema.sql first.
--   3. Select the camera_app database before running this script.
--
-- Scope:
--   1. Add and backfill current certification fields in real_name_certifications.
--   2. Add and backfill current audit fields in audit_records.
--   3. Add and backfill current dispute fields in disputes.
--   4. Relax old dispute columns that current Java inserts no longer populate.
--   5. Expand notifications.title and notifications.type to D-line lengths.
--
-- Safety:
--   - Does not drop tables.
--   - Does not delete data.
--   - Does not remove old columns.
--   - Does not modify disputes.refund_amount because Java Long vs MySQL DECIMAL(10,2)
--     yuan/cent semantics are not confirmed.

DELIMITER //

DROP PROCEDURE IF EXISTS local_patch_add_column_if_missing//
CREATE PROCEDURE local_patch_add_column_if_missing(
    IN p_table_name VARCHAR(64),
    IN p_column_name VARCHAR(64),
    IN p_column_definition TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = p_table_name
          AND column_name = p_column_name
    ) THEN
        SET @local_patch_sql = CONCAT('ALTER TABLE `', p_table_name, '` ADD COLUMN ', p_column_definition);
        PREPARE local_patch_stmt FROM @local_patch_sql;
        EXECUTE local_patch_stmt;
        DEALLOCATE PREPARE local_patch_stmt;
    END IF;
END//

DROP PROCEDURE IF EXISTS local_patch_update_column_from_old_if_both_exist//
CREATE PROCEDURE local_patch_update_column_from_old_if_both_exist(
    IN p_table_name VARCHAR(64),
    IN p_new_column_name VARCHAR(64),
    IN p_old_column_name VARCHAR(64)
)
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = p_table_name
          AND column_name = p_new_column_name
    ) AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = p_table_name
          AND column_name = p_old_column_name
    ) THEN
        SET @local_patch_sql = CONCAT(
            'UPDATE `', p_table_name, '` ',
            'SET `', p_new_column_name, '` = COALESCE(`', p_new_column_name, '`, `', p_old_column_name, '`) ',
            'WHERE `', p_new_column_name, '` IS NULL ',
            'AND `', p_old_column_name, '` IS NOT NULL'
        );
        PREPARE local_patch_stmt FROM @local_patch_sql;
        EXECUTE local_patch_stmt;
        DEALLOCATE PREPARE local_patch_stmt;
    END IF;
END//

DROP PROCEDURE IF EXISTS local_patch_modify_column_if_not_nullable//
CREATE PROCEDURE local_patch_modify_column_if_not_nullable(
    IN p_table_name VARCHAR(64),
    IN p_column_name VARCHAR(64),
    IN p_column_definition TEXT
)
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = p_table_name
          AND column_name = p_column_name
          AND is_nullable = 'NO'
    ) THEN
        SET @local_patch_sql = CONCAT('ALTER TABLE `', p_table_name, '` MODIFY COLUMN ', p_column_definition);
        PREPARE local_patch_stmt FROM @local_patch_sql;
        EXECUTE local_patch_stmt;
        DEALLOCATE PREPARE local_patch_stmt;
    END IF;
END//

DROP PROCEDURE IF EXISTS local_patch_expand_varchar_if_shorter//
CREATE PROCEDURE local_patch_expand_varchar_if_shorter(
    IN p_table_name VARCHAR(64),
    IN p_column_name VARCHAR(64),
    IN p_min_length INT,
    IN p_column_definition TEXT
)
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = p_table_name
          AND column_name = p_column_name
          AND data_type = 'varchar'
          AND character_maximum_length < p_min_length
    ) THEN
        SET @local_patch_sql = CONCAT('ALTER TABLE `', p_table_name, '` MODIFY COLUMN ', p_column_definition);
        PREPARE local_patch_stmt FROM @local_patch_sql;
        EXECUTE local_patch_stmt;
        DEALLOCATE PREPARE local_patch_stmt;
    END IF;
END//

DROP PROCEDURE IF EXISTS local_patch_create_index_if_missing//
CREATE PROCEDURE local_patch_create_index_if_missing(
    IN p_table_name VARCHAR(64),
    IN p_index_name VARCHAR(64),
    IN p_index_definition TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = p_table_name
          AND index_name = p_index_name
    ) THEN
        SET @local_patch_sql = CONCAT('ALTER TABLE `', p_table_name, '` ADD ', p_index_definition);
        PREPARE local_patch_stmt FROM @local_patch_sql;
        EXECUTE local_patch_stmt;
        DEALLOCATE PREPARE local_patch_stmt;
    END IF;
END//

DELIMITER ;

-- 1. real_name_certifications: add current Java/MyBatis fields and backfill from P3 fields.
CALL local_patch_add_column_if_missing(
    'real_name_certifications',
    'real_name',
    '`real_name` VARCHAR(64) NULL COMMENT ''Real name used by current admin certification entity'''
);
CALL local_patch_add_column_if_missing(
    'real_name_certifications',
    'id_card_number',
    '`id_card_number` VARCHAR(50) NULL COMMENT ''Masked ID card number used by current admin certification entity'''
);
CALL local_patch_add_column_if_missing(
    'real_name_certifications',
    'created_at',
    '`created_at` DATETIME NULL COMMENT ''Creation time used by current admin certification entity'''
);
CALL local_patch_add_column_if_missing(
    'real_name_certifications',
    'reviewer_admin_id',
    '`reviewer_admin_id` BIGINT NULL COMMENT ''Reviewer admin id used by current admin certification entity'''
);

CALL local_patch_update_column_from_old_if_both_exist('real_name_certifications', 'real_name', 'real_name_masked');
CALL local_patch_update_column_from_old_if_both_exist('real_name_certifications', 'id_card_number', 'id_card_no_masked');
CALL local_patch_update_column_from_old_if_both_exist('real_name_certifications', 'created_at', 'applied_at');
CALL local_patch_update_column_from_old_if_both_exist('real_name_certifications', 'reviewer_admin_id', 'reviewer_id');

CALL local_patch_create_index_if_missing(
    'real_name_certifications',
    'idx_cert_user_id',
    'INDEX `idx_cert_user_id` (`user_id`)'
);

-- 2. audit_records: add current Java fields and backfill from P3 fields.
CALL local_patch_add_column_if_missing(
    'audit_records',
    'target_type',
    '`target_type` VARCHAR(50) NULL COMMENT ''Audit target type used by current admin audit entity'''
);
CALL local_patch_add_column_if_missing(
    'audit_records',
    'action',
    '`action` VARCHAR(30) NULL COMMENT ''Audit action used by current admin audit entity'''
);
CALL local_patch_add_column_if_missing(
    'audit_records',
    'reason',
    '`reason` VARCHAR(500) NULL COMMENT ''Audit note used by current admin audit entity'''
);

CALL local_patch_update_column_from_old_if_both_exist('audit_records', 'target_type', 'audit_type');
CALL local_patch_update_column_from_old_if_both_exist('audit_records', 'action', 'audit_result');
CALL local_patch_update_column_from_old_if_both_exist('audit_records', 'reason', 'remark');

CALL local_patch_create_index_if_missing(
    'audit_records',
    'idx_target',
    'INDEX `idx_target` (`target_type`, `target_id`)'
);

-- 3. disputes: add current Java fields and backfill from P3 fields.
CALL local_patch_add_column_if_missing(
    'disputes',
    'initiator_id',
    '`initiator_id` BIGINT NULL COMMENT ''Initiating user id used by current dispute entity'''
);
CALL local_patch_add_column_if_missing(
    'disputes',
    'reason',
    '`reason` TEXT NULL COMMENT ''Dispute reason used by current dispute entity'''
);
CALL local_patch_add_column_if_missing(
    'disputes',
    'resolution',
    '`resolution` VARCHAR(40) NULL COMMENT ''Arbitration resolution used by current dispute entity'''
);
CALL local_patch_add_column_if_missing(
    'disputes',
    'responsibility',
    '`responsibility` VARCHAR(30) NULL COMMENT ''Responsibility party used by current dispute entity'''
);
CALL local_patch_add_column_if_missing(
    'disputes',
    'admin_comment',
    '`admin_comment` TEXT NULL COMMENT ''Admin comment used by current dispute entity'''
);
CALL local_patch_add_column_if_missing(
    'disputes',
    'created_at',
    '`created_at` DATETIME NULL COMMENT ''Creation time used by current dispute entity'''
);
CALL local_patch_add_column_if_missing(
    'disputes',
    'updated_at',
    '`updated_at` DATETIME NULL COMMENT ''Update time used by current dispute entity'''
);
CALL local_patch_add_column_if_missing(
    'disputes',
    'resolved_at',
    '`resolved_at` DATETIME NULL COMMENT ''Resolution time used by current dispute entity'''
);

CALL local_patch_update_column_from_old_if_both_exist('disputes', 'initiator_id', 'applicant_id');
CALL local_patch_update_column_from_old_if_both_exist('disputes', 'reason', 'description');
CALL local_patch_update_column_from_old_if_both_exist('disputes', 'resolution', 'result');
CALL local_patch_update_column_from_old_if_both_exist('disputes', 'admin_comment', 'admin_remark');
CALL local_patch_update_column_from_old_if_both_exist('disputes', 'created_at', 'create_time');
CALL local_patch_update_column_from_old_if_both_exist('disputes', 'updated_at', 'create_time');
CALL local_patch_update_column_from_old_if_both_exist('disputes', 'resolved_at', 'resolve_time');

-- Current Java inserts do not populate these legacy NOT NULL columns.
-- Relax them only if they exist and are still NOT NULL.
CALL local_patch_modify_column_if_not_nullable('disputes', 'applicant_id', '`applicant_id` BIGINT NULL');
CALL local_patch_modify_column_if_not_nullable('disputes', 'respondent_id', '`respondent_id` BIGINT NULL');
CALL local_patch_modify_column_if_not_nullable('disputes', 'type', '`type` VARCHAR(40) NULL');
CALL local_patch_modify_column_if_not_nullable('disputes', 'description', '`description` TEXT NULL');
CALL local_patch_modify_column_if_not_nullable('disputes', 'create_time', '`create_time` DATETIME NULL DEFAULT CURRENT_TIMESTAMP');

-- 4. notifications: expand D-line lengths without shrinking or touching content.
CALL local_patch_expand_varchar_if_shorter(
    'notifications',
    'title',
    255,
    '`title` VARCHAR(255) NOT NULL'
);
CALL local_patch_expand_varchar_if_shorter(
    'notifications',
    'type',
    60,
    '`type` VARCHAR(60) NOT NULL'
);

DROP PROCEDURE IF EXISTS local_patch_create_index_if_missing;
DROP PROCEDURE IF EXISTS local_patch_expand_varchar_if_shorter;
DROP PROCEDURE IF EXISTS local_patch_modify_column_if_not_nullable;
DROP PROCEDURE IF EXISTS local_patch_update_column_from_old_if_both_exist;
DROP PROCEDURE IF EXISTS local_patch_add_column_if_missing;

SET @local_patch_sql = NULL;
