-- REVIEW ONLY. Run manually only against the approved integration database after backup.
-- Additive schema; never automatically invoked. Existing 17 migrations must NOT be repeated.
-- Explicit target prevents accidentally using portra_staging; no USE or cross-database grants.
ALTER TABLE portra_integration.sms_challenges
  ADD COLUMN challenge_id VARCHAR(36) NULL,
  ADD COLUMN owner_user_id BIGINT NULL,
  ADD COLUMN owner_session_id VARCHAR(128) NULL,
  ADD COLUMN operation VARCHAR(32) NULL,
  ADD COLUMN invalidated_at DATETIME(6) NULL,
  ADD UNIQUE KEY uk_sms_challenge_id (challenge_id);
CREATE TABLE portra_integration.sms_challenge_locks (
  lock_key VARCHAR(64) NOT NULL PRIMARY KEY
) ENGINE=InnoDB;
-- Legacy challenges have NULL challenge_id and cannot be consumed by the new service.
-- Application account only needs its existing integration-scoped DML privileges.
