-- B AUTH persistence after migration/add_auth_phone_account.sql.
-- MySQL 8.0-compatible and repeatable. This script never stores a plaintext phone.

SET @schema_name = DATABASE();

DELIMITER //
DROP PROCEDURE IF EXISTS require_auth_phone_account//
CREATE PROCEDURE require_auth_phone_account()
BEGIN
    DECLARE required_mobile_columns INT DEFAULT 0;
    SELECT COUNT(*) INTO required_mobile_columns
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name IN ('mobile_cipher', 'mobile_hash', 'mobile_masked', 'phone_verified_at');
    IF required_mobile_columns <> 4 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'add_auth_phone_account.sql must run first';
    END IF;
END//
CALL require_auth_phone_account()//
DROP PROCEDURE require_auth_phone_account//
DELIMITER ;

-- A pre-integration B build may have created users.phone in plaintext. An empty
-- legacy column can be removed automatically. Real values need an application
-- controlled decrypt/normalize/HMAC/encrypt conversion and must never be dropped.
DELIMITER //
DROP PROCEDURE IF EXISTS remove_empty_legacy_user_phone//
CREATE PROCEDURE remove_empty_legacy_user_phone()
BEGIN
    DECLARE legacy_phone_column INT DEFAULT 0;
    DECLARE legacy_phone_rows BIGINT DEFAULT 0;
    DECLARE legacy_phone_index INT DEFAULT 0;

    SELECT COUNT(*) INTO legacy_phone_column
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'users'
      AND column_name = 'phone';

    IF legacy_phone_column > 0 THEN
        SELECT COUNT(*) INTO legacy_phone_rows FROM users WHERE phone IS NOT NULL;
        IF legacy_phone_rows > 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'LEGACY users.phone DATA REQUIRES CONTROLLED APPLICATION CONVERSION';
        END IF;

        SELECT COUNT(*) INTO legacy_phone_index
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 'users'
          AND index_name = 'uk_users_phone';
        IF legacy_phone_index > 0 THEN
            ALTER TABLE users DROP INDEX uk_users_phone;
        END IF;
        ALTER TABLE users DROP COLUMN phone;
    END IF;
END//
CALL remove_empty_legacy_user_phone()//
DROP PROCEDURE remove_empty_legacy_user_phone//
DELIMITER ;

SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE users ADD COLUMN last_login_at DATETIME(6) NULL',
        'SELECT ''users.last_login_at already exists'' AS message'
    )
    FROM information_schema.columns
    WHERE table_schema = @schema_name
      AND table_name = 'users'
      AND column_name = 'last_login_at'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- SMS challenges are short-lived. We can reshape an empty legacy table, but an
-- operator must deliberately purge or archive populated plaintext challenges.
DELIMITER //
DROP PROCEDURE IF EXISTS migrate_legacy_sms_challenges//
CREATE PROCEDURE migrate_legacy_sms_challenges()
BEGIN
    DECLARE sms_table_count INT DEFAULT 0;
    DECLARE plaintext_phone_column INT DEFAULT 0;
    DECLARE hashed_phone_column INT DEFAULT 0;
    DECLARE challenge_rows BIGINT DEFAULT 0;
    DECLARE legacy_index_count INT DEFAULT 0;

    SELECT COUNT(*) INTO sms_table_count
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'sms_challenges';
    IF sms_table_count > 0 THEN
        SELECT COUNT(*) INTO plaintext_phone_column
        FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'sms_challenges' AND column_name = 'phone';
        SELECT COUNT(*) INTO hashed_phone_column
        FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'sms_challenges' AND column_name = 'phone_hash';

        IF plaintext_phone_column > 0 AND hashed_phone_column = 0 THEN
            SELECT COUNT(*) INTO challenge_rows FROM sms_challenges;
            IF challenge_rows > 0 THEN
                SIGNAL SQLSTATE '45000'
                    SET MESSAGE_TEXT = 'PLAINTEXT SMS CHALLENGES REQUIRE CONTROLLED PURGE BEFORE MIGRATION';
            END IF;
            SELECT COUNT(*) INTO legacy_index_count
            FROM information_schema.statistics
            WHERE table_schema = DATABASE()
              AND table_name = 'sms_challenges'
              AND index_name = 'idx_sms_phone_purpose_created';
            IF legacy_index_count > 0 THEN
                ALTER TABLE sms_challenges DROP INDEX idx_sms_phone_purpose_created;
            END IF;
            ALTER TABLE sms_challenges CHANGE COLUMN phone phone_hash CHAR(64) NOT NULL;
            ALTER TABLE sms_challenges
                ADD INDEX idx_sms_phone_hash_purpose_created (phone_hash, purpose, created_at);
        ELSEIF plaintext_phone_column > 0 OR hashed_phone_column = 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'sms_challenges HAS AN INCOMPATIBLE PHONE IDENTITY SCHEMA';
        END IF;
    END IF;
END//
CALL migrate_legacy_sms_challenges()//
DROP PROCEDURE migrate_legacy_sms_challenges//
DELIMITER ;

CREATE TABLE IF NOT EXISTS sms_challenges (
    id                  BIGINT       PRIMARY KEY AUTO_INCREMENT,
    phone_hash          CHAR(64)     NOT NULL,
    purpose             VARCHAR(32)  NOT NULL,
    code_hash           VARCHAR(100) NOT NULL,
    expires_at          DATETIME(6)  NOT NULL,
    attempt_count       INT          NOT NULL DEFAULT 0,
    max_attempts        INT          NOT NULL DEFAULT 5,
    consumed_at         DATETIME(6)  NULL,
    request_ip          VARCHAR(45)  NULL,
    device_id           VARCHAR(128) NULL,
    delivery_status     VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    provider_message_id VARCHAR(128) NULL,
    sent_at             DATETIME(6)  NULL,
    created_at          DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    last_attempt_at     DATETIME(6)  NULL,
    KEY idx_sms_phone_hash_purpose_created (phone_hash, purpose, created_at),
    KEY idx_sms_ip_created (request_ip, created_at),
    KEY idx_sms_device_created (device_id, created_at),
    KEY idx_sms_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Hashed SMS verification challenges and abuse-control metadata';

CREATE TABLE IF NOT EXISTS user_sessions (
    id                 BIGINT       PRIMARY KEY AUTO_INCREMENT,
    session_id         VARCHAR(64)  NOT NULL,
    user_id            BIGINT       NOT NULL,
    refresh_token_hash CHAR(64)     NOT NULL,
    device_id          VARCHAR(128) NULL,
    device_name        VARCHAR(128) NULL,
    created_at         DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    expires_at         DATETIME(6)  NOT NULL,
    last_seen_at       DATETIME(6)  NULL,
    revoked_at         DATETIME(6)  NULL,
    revoke_reason      VARCHAR(64)  NULL,
    UNIQUE KEY uk_user_sessions_session_id (session_id),
    UNIQUE KEY uk_user_sessions_refresh_hash (refresh_token_hash),
    KEY idx_user_sessions_user_active (user_id, revoked_at, expires_at),
    KEY idx_user_sessions_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Server-side state for revocable access and refresh sessions';

SELECT column_name, column_type, is_nullable
FROM information_schema.columns
WHERE table_schema = @schema_name
  AND ((table_name = 'users' AND column_name = 'last_login_at')
    OR (table_name = 'sms_challenges' AND column_name = 'phone_hash'))
ORDER BY table_name, ordinal_position;

SELECT table_name, index_name, non_unique, seq_in_index, column_name
FROM information_schema.statistics
WHERE table_schema = @schema_name
  AND table_name IN ('sms_challenges', 'user_sessions')
  AND index_name IN (
      'idx_sms_phone_hash_purpose_created',
      'idx_sms_ip_created',
      'idx_sms_device_created',
      'idx_sms_expires_at',
      'uk_user_sessions_session_id',
      'uk_user_sessions_refresh_hash',
      'idx_user_sessions_user_active',
      'idx_user_sessions_expires_at'
  )
ORDER BY table_name, index_name, seq_in_index;
