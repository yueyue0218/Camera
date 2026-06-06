-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- WARNING: This script contains UPDATE backfill statements.
-- BACKUP YOUR DATABASE before executing.
-- This script is ONE-TIME ONLY for migrating legacy databases.
-- Do NOT execute on a fresh database initialized from V1_baseline.sql.
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- Compatibility migration for databases created from docs/P3/04_建表SQL.sql.
-- Run once before deploying the unified real-name certification flow.
-- All DDL operations are idempotent and safe to re-execute.

-- ── provider_profiles ──────────────────────────────────────────────────────

SET @cert_compat_ddl = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `provider_profiles` ADD COLUMN `age` TINYINT UNSIGNED NULL COMMENT ''Provider age''',
        'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name   = 'provider_profiles'
      AND column_name  = 'age'
);
PREPARE cert_compat_stmt FROM @cert_compat_ddl;
EXECUTE cert_compat_stmt;
DEALLOCATE PREPARE cert_compat_stmt;

SET @cert_compat_ddl = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `provider_profiles` ADD COLUMN `equipment` VARCHAR(500) NULL COMMENT ''Common camera equipment''',
        'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name   = 'provider_profiles'
      AND column_name  = 'equipment'
);
PREPARE cert_compat_stmt FROM @cert_compat_ddl;
EXECUTE cert_compat_stmt;
DEALLOCATE PREPARE cert_compat_stmt;

-- ── real_name_certifications: add missing columns ──────────────────────────

SET @cert_compat_ddl = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `real_name_certifications` ADD COLUMN `real_name` VARCHAR(50) NULL COMMENT ''Real name''',
        'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name   = 'real_name_certifications'
      AND column_name  = 'real_name'
);
PREPARE cert_compat_stmt FROM @cert_compat_ddl;
EXECUTE cert_compat_stmt;
DEALLOCATE PREPARE cert_compat_stmt;

SET @cert_compat_ddl = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `real_name_certifications` ADD COLUMN `id_card_number` VARCHAR(50) NULL COMMENT ''Masked ID card number''',
        'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name   = 'real_name_certifications'
      AND column_name  = 'id_card_number'
);
PREPARE cert_compat_stmt FROM @cert_compat_ddl;
EXECUTE cert_compat_stmt;
DEALLOCATE PREPARE cert_compat_stmt;

SET @cert_compat_ddl = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `real_name_certifications` ADD COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
        'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name   = 'real_name_certifications'
      AND column_name  = 'created_at'
);
PREPARE cert_compat_stmt FROM @cert_compat_ddl;
EXECUTE cert_compat_stmt;
DEALLOCATE PREPARE cert_compat_stmt;

SET @cert_compat_ddl = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `real_name_certifications` ADD COLUMN `reviewer_admin_id` BIGINT NULL',
        'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name   = 'real_name_certifications'
      AND column_name  = 'reviewer_admin_id'
);
PREPARE cert_compat_stmt FROM @cert_compat_ddl;
EXECUTE cert_compat_stmt;
DEALLOCATE PREPARE cert_compat_stmt;

-- real_name_certifications: relax P3 old columns (MODIFY is idempotent)
ALTER TABLE real_name_certifications
    MODIFY COLUMN real_name_masked  VARCHAR(64) NULL,
    MODIFY COLUMN id_card_no_cipher VARBINARY(512) NULL,
    MODIFY COLUMN id_card_no_hash   CHAR(64) NULL,
    MODIFY COLUMN id_card_no_masked VARCHAR(32) NULL;

-- real_name_certifications: ensure idx_user_id exists (canonical name from certification.sql)
SET @cert_compat_ddl = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `real_name_certifications` ADD KEY `idx_user_id` (`user_id`)',
        'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name   = 'real_name_certifications'
      AND index_name   = 'idx_user_id'
);
PREPARE cert_compat_stmt FROM @cert_compat_ddl;
EXECUTE cert_compat_stmt;
DEALLOCATE PREPARE cert_compat_stmt;

-- real_name_certifications: drop idx_cert_user_id if it exists (duplicate of idx_user_id)
SET @cert_compat_ddl = (
    SELECT IF(COUNT(*) > 0,
        'ALTER TABLE `real_name_certifications` DROP INDEX `idx_cert_user_id`',
        'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name   = 'real_name_certifications'
      AND index_name   = 'idx_cert_user_id'
);
PREPARE cert_compat_stmt FROM @cert_compat_ddl;
EXECUTE cert_compat_stmt;
DEALLOCATE PREPARE cert_compat_stmt;

-- real_name_certifications: drop uk_real_name_user only if it exists
SET @cert_compat_ddl = (
    SELECT IF(COUNT(*) > 0,
        'ALTER TABLE `real_name_certifications` DROP INDEX `uk_real_name_user`',
        'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name   = 'real_name_certifications'
      AND index_name   = 'uk_real_name_user'
);
PREPARE cert_compat_stmt FROM @cert_compat_ddl;
EXECUTE cert_compat_stmt;
DEALLOCATE PREPARE cert_compat_stmt;

-- ── data backfill ──────────────────────────────────────────────────────────

UPDATE real_name_certifications
SET real_name         = COALESCE(real_name, real_name_masked),
    id_card_number    = COALESCE(id_card_number, id_card_no_masked),
    created_at        = COALESCE(created_at, applied_at),
    reviewer_admin_id = COALESCE(reviewer_admin_id, reviewer_id);

UPDATE real_name_certifications
SET status = 'PENDING'
WHERE status = 'PENDING_REVIEW';

ALTER TABLE real_name_certifications
    MODIFY COLUMN real_name      VARCHAR(50) NOT NULL COMMENT 'Real name',
    MODIFY COLUMN id_card_number VARCHAR(50) NOT NULL COMMENT 'Masked ID card number';

-- ── audit_records: add missing columns ────────────────────────────────────

SET @cert_compat_ddl = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `audit_records` ADD COLUMN `target_type` VARCHAR(50) NULL COMMENT ''Audit target type''',
        'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name   = 'audit_records'
      AND column_name  = 'target_type'
);
PREPARE cert_compat_stmt FROM @cert_compat_ddl;
EXECUTE cert_compat_stmt;
DEALLOCATE PREPARE cert_compat_stmt;

SET @cert_compat_ddl = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `audit_records` ADD COLUMN `action` VARCHAR(20) NULL COMMENT ''Audit action''',
        'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name   = 'audit_records'
      AND column_name  = 'action'
);
PREPARE cert_compat_stmt FROM @cert_compat_ddl;
EXECUTE cert_compat_stmt;
DEALLOCATE PREPARE cert_compat_stmt;

SET @cert_compat_ddl = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `audit_records` ADD COLUMN `reason` VARCHAR(500) NULL COMMENT ''Audit note''',
        'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name   = 'audit_records'
      AND column_name  = 'reason'
);
PREPARE cert_compat_stmt FROM @cert_compat_ddl;
EXECUTE cert_compat_stmt;
DEALLOCATE PREPARE cert_compat_stmt;

-- audit_records: relax P3 old columns (MODIFY is idempotent)
ALTER TABLE audit_records
    MODIFY COLUMN audit_type   VARCHAR(40) NULL,
    MODIFY COLUMN audit_result VARCHAR(30) NULL;

-- audit_records: add idx_target if missing
SET @cert_compat_ddl = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `audit_records` ADD KEY `idx_target` (`target_type`, `target_id`)',
        'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name   = 'audit_records'
      AND index_name   = 'idx_target'
);
PREPARE cert_compat_stmt FROM @cert_compat_ddl;
EXECUTE cert_compat_stmt;
DEALLOCATE PREPARE cert_compat_stmt;

-- ── data backfill ──────────────────────────────────────────────────────────

UPDATE audit_records
SET target_type = COALESCE(target_type, audit_type),
    action      = COALESCE(action, audit_result),
    reason      = COALESCE(reason, remark);

ALTER TABLE audit_records
    MODIFY COLUMN target_type VARCHAR(50) NOT NULL COMMENT 'Audit target type',
    MODIFY COLUMN action      VARCHAR(20) NOT NULL COMMENT 'Audit action';

SET @cert_compat_ddl = NULL;
