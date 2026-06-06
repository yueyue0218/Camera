-- Dual-identity migration: provider avatar + follow-role tracking.
-- All DDL operations are idempotent and safe to re-execute.

-- STEP 3: Provider-specific avatar field
SET @dual_id_ddl = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `provider_profiles` ADD COLUMN `provider_avatar_file_id` BIGINT NULL',
        'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name   = 'provider_profiles'
      AND column_name  = 'provider_avatar_file_id'
);
PREPARE dual_id_stmt FROM @dual_id_ddl;
EXECUTE dual_id_stmt;
DEALLOCATE PREPARE dual_id_stmt;

-- STEP 5: Follow relationships track which identity (role) of the target is being followed
SET @dual_id_ddl = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `user_follows` ADD COLUMN `target_role` VARCHAR(20) NOT NULL DEFAULT ''CUSTOMER''',
        'SELECT 1')
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name   = 'user_follows'
      AND column_name  = 'target_role'
);
PREPARE dual_id_stmt FROM @dual_id_ddl;
EXECUTE dual_id_stmt;
DEALLOCATE PREPARE dual_id_stmt;

-- Replace the 2-column unique index with a 3-column one: drop old index only if it exists
SET @dual_id_ddl = (
    SELECT IF(COUNT(*) > 0,
        'ALTER TABLE `user_follows` DROP INDEX `uk_user_follows_pair`',
        'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name   = 'user_follows'
      AND index_name   = 'uk_user_follows_pair'
);
PREPARE dual_id_stmt FROM @dual_id_ddl;
EXECUTE dual_id_stmt;
DEALLOCATE PREPARE dual_id_stmt;

-- Add 3-column unique constraint only if it does not yet exist
SET @dual_id_ddl = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE `user_follows` ADD CONSTRAINT `uk_user_follows_triple` UNIQUE (`follower_id`, `following_user_id`, `target_role`)',
        'SELECT 1')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name   = 'user_follows'
      AND index_name   = 'uk_user_follows_triple'
);
PREPARE dual_id_stmt FROM @dual_id_ddl;
EXECUTE dual_id_stmt;
DEALLOCATE PREPARE dual_id_stmt;

SET @dual_id_ddl = NULL;
