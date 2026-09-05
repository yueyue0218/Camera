-- Phone authentication and revocable session persistence.
-- MySQL 8.0-compatible repeatable migration used by both:
--   Path A: fresh initialization after V1_baseline.sql has created users.
--   Path B: existing database upgrade before deploying phone-auth code.
-- Existing users remain valid with phone = NULL. Adding uk_users_phone deliberately
-- fails if a partially migrated database already contains duplicate non-null phones.

SET @schema_name = DATABASE();

SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL',
        'SELECT ''users.phone already exists'' AS message'
    )
    FROM information_schema.columns
    WHERE table_schema = @schema_name
      AND table_name = 'users'
      AND column_name = 'phone'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE users ADD COLUMN phone_verified_at DATETIME NULL',
        'SELECT ''users.phone_verified_at already exists'' AS message'
    )
    FROM information_schema.columns
    WHERE table_schema = @schema_name
      AND table_name = 'users'
      AND column_name = 'phone_verified_at'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE users ADD COLUMN last_login_at DATETIME NULL',
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

SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE users ADD UNIQUE INDEX uk_users_phone (phone)',
        'SELECT ''users.uk_users_phone already exists'' AS message'
    )
    FROM information_schema.statistics
    WHERE table_schema = @schema_name
      AND table_name = 'users'
      AND index_name = 'uk_users_phone'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS sms_challenges (
    id              BIGINT       PRIMARY KEY AUTO_INCREMENT,
    phone           VARCHAR(20)  NOT NULL,
    purpose         VARCHAR(32)  NOT NULL,
    code_hash       VARCHAR(100) NOT NULL,
    expires_at      DATETIME     NOT NULL,
    attempt_count   INT          NOT NULL DEFAULT 0,
    max_attempts    INT          NOT NULL DEFAULT 5,
    consumed_at     DATETIME     NULL,
    request_ip      VARCHAR(45)  NULL,
    device_id       VARCHAR(128) NULL,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_attempt_at DATETIME     NULL,
    KEY idx_sms_phone_purpose_created (phone, purpose, created_at),
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
    created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at         DATETIME     NOT NULL,
    last_seen_at       DATETIME     NULL,
    revoked_at         DATETIME     NULL,
    revoke_reason      VARCHAR(64)  NULL,
    UNIQUE KEY uk_user_sessions_session_id (session_id),
    UNIQUE KEY uk_user_sessions_refresh_hash (refresh_token_hash),
    KEY idx_user_sessions_user_active (user_id, revoked_at, expires_at),
    KEY idx_user_sessions_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Server-side state for revocable access and refresh sessions';

-- Post-migration verification. duplicate_phone_count must be zero; the unique
-- index above also prevents any future duplicate non-null normalized phone.
SELECT COUNT(*) AS duplicate_phone_count
FROM (
    SELECT phone
    FROM users
    WHERE phone IS NOT NULL
    GROUP BY phone
    HAVING COUNT(*) > 1
) duplicate_phones;

SELECT table_name, index_name, non_unique, seq_in_index, column_name
FROM information_schema.statistics
WHERE table_schema = @schema_name
  AND table_name IN ('users', 'sms_challenges', 'user_sessions')
  AND index_name IN (
      'uk_users_phone',
      'idx_sms_phone_purpose_created',
      'idx_sms_ip_created',
      'idx_sms_device_created',
      'idx_sms_expires_at',
      'uk_user_sessions_session_id',
      'uk_user_sessions_refresh_hash',
      'idx_user_sessions_user_active',
      'idx_user_sessions_expires_at'
  )
ORDER BY table_name, index_name, seq_in_index;
