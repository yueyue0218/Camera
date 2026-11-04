-- Approved execution only, after a verified recoverable backup and stopped 8080 writes.
-- Reuses V20261103__sms_challenge_binding.sql; only the database qualifier changes.
-- NOT idempotent. Never rerun after a partial failure. No legacy row updates/deletes.
ALTER TABLE portra_staging.sms_challenges
  ADD COLUMN challenge_id VARCHAR(36) NULL,
  ADD COLUMN owner_user_id BIGINT NULL,
  ADD COLUMN owner_session_id VARCHAR(128) NULL,
  ADD COLUMN operation VARCHAR(32) NULL,
  ADD COLUMN invalidated_at DATETIME(6) NULL,
  ADD UNIQUE KEY uk_sms_challenge_id (challenge_id);
CREATE TABLE portra_staging.sms_challenge_locks (
  lock_key VARCHAR(64) NOT NULL PRIMARY KEY
) ENGINE=InnoDB;
-- Nullable additions have implicit DEFAULT NULL, leaving historical challenges intact.
-- Legacy NULL challenge_id cannot be consumed; clients must request a new challenge.
