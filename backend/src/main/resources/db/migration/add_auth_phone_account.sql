-- A5 auth phone-account schema migration.
-- Scope: nullable storage contract only. No phone backfill and no auth/session behavior.
-- Supports both the repository baseline (no mobile columns) and the historical P3 schema.
-- Requires mysql CLI or MySQL Workbench because this script defines a temporary procedure.

DELIMITER //

DROP PROCEDURE IF EXISTS migrate_auth_phone_account//
CREATE PROCEDURE migrate_auth_phone_account()
BEGIN
    DECLARE users_table_count INT DEFAULT 0;
    DECLARE column_count INT DEFAULT 0;
    DECLARE duplicate_hash_groups INT DEFAULT 0;
    DECLARE named_index_rows INT DEFAULT 0;
    DECLARE valid_named_index_rows INT DEFAULT 0;

    SELECT COUNT(*) INTO users_table_count
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = 'users';

    IF users_table_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'users table is required before auth phone migration';
    END IF;

    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name = 'mobile_cipher';
    IF column_count = 0 THEN
        ALTER TABLE `users`
            ADD COLUMN `mobile_cipher` VARBINARY(512) NULL DEFAULT NULL
                COMMENT 'Encrypted normalized phone; plaintext storage is forbidden';
    END IF;

    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name = 'mobile_hash';
    IF column_count = 0 THEN
        ALTER TABLE `users`
            ADD COLUMN `mobile_hash` CHAR(64) NULL DEFAULT NULL
                COMMENT 'Normalized-phone hash contract; algorithm and normalization owned by B';
    END IF;

    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name = 'mobile_masked';
    IF column_count = 0 THEN
        ALTER TABLE `users`
            ADD COLUMN `mobile_masked` VARCHAR(32) NULL DEFAULT NULL
                COMMENT 'Masked phone display value; never used as login identity';
    END IF;

    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name = 'phone_verified_at';
    IF column_count = 0 THEN
        ALTER TABLE `users`
            ADD COLUMN `phone_verified_at` DATETIME(6) NULL DEFAULT NULL
                COMMENT 'Actual phone verification completion time; null means not verified';
    END IF;

    -- STOP before unique DDL when historical non-null hashes conflict.
    SELECT COUNT(*) INTO duplicate_hash_groups
    FROM (
        SELECT mobile_hash
        FROM users
        WHERE mobile_hash IS NOT NULL
        GROUP BY mobile_hash
        HAVING COUNT(*) > 1
    ) duplicate_mobile_hashes;

    IF duplicate_hash_groups > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'DUPLICATE MOBILE HASH DETECTED';
    END IF;

    SELECT COUNT(*) INTO named_index_rows
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND index_name = 'uk_users_mobile_hash';

    IF named_index_rows = 0 THEN
        ALTER TABLE `users`
            ADD CONSTRAINT `uk_users_mobile_hash` UNIQUE (`mobile_hash`);
    ELSE
        SELECT COUNT(*) INTO valid_named_index_rows
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 'users'
          AND index_name = 'uk_users_mobile_hash'
          AND non_unique = 0
          AND seq_in_index = 1
          AND column_name = 'mobile_hash';

        IF named_index_rows <> 1 OR valid_named_index_rows <> 1 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'uk_users_mobile_hash exists with incompatible definition';
        END IF;
    END IF;
END//

CALL migrate_auth_phone_account()//
DROP PROCEDURE migrate_auth_phone_account//

DELIMITER ;

-- Repeatable post-migration verification. These statements do not mutate user data.
SELECT column_name, column_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'users'
  AND column_name IN ('mobile_cipher', 'mobile_hash', 'mobile_masked', 'phone_verified_at')
ORDER BY ordinal_position;

SELECT index_name, non_unique, seq_in_index, column_name
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'users'
  AND index_name = 'uk_users_mobile_hash'
ORDER BY seq_in_index;

SELECT
    SUM(mobile_cipher IS NULL AND mobile_hash IS NULL AND mobile_masked IS NULL
        AND phone_verified_at IS NULL) AS legacy_unbound_count,
    SUM(mobile_hash IS NOT NULL AND (mobile_cipher IS NULL OR mobile_masked IS NULL
        OR phone_verified_at IS NULL)) AS partial_or_inconsistent_count
FROM users;
