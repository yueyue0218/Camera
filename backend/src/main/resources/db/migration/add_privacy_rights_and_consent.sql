-- Portra P0 privacy rights / Hong Kong consent. REVIEW ONLY: never run on production from this task.
-- Prerequisites: current schema incl. add_account_cancellation_requests.sql and phone auth sessions.
-- Additive migration, no existing data rewritten; existing web users remain NOT_RECORDED.
-- Harmony native requests are fail-closed until a current account grant is recorded.
CREATE TABLE IF NOT EXISTS privacy_consents (
    user_id BIGINT NOT NULL PRIMARY KEY,
    consent_type VARCHAR(40) NOT NULL,
    status VARCHAR(20) NOT NULL,
    privacy_policy_version VARCHAR(40) NOT NULL,
    cross_border_consent_version VARCHAR(40) NOT NULL,
    installation_id VARCHAR(128) NOT NULL,
    accepted_at_epoch_ms BIGINT NOT NULL,
    occurred_at DATETIME(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS privacy_consent_events (
    id BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    consent_type VARCHAR(40) NOT NULL,
    status VARCHAR(20) NOT NULL,
    privacy_policy_version VARCHAR(40) NOT NULL,
    cross_border_consent_version VARCHAR(40) NOT NULL,
    installation_id VARCHAR(128) NOT NULL,
    accepted_at_epoch_ms BIGINT NOT NULL,
    occurred_at DATETIME(6) NOT NULL,
    KEY idx_privacy_consent_event_user (user_id, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS privacy_right_requests (
    id BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    type VARCHAR(20) NOT NULL,
    description VARCHAR(2000) NOT NULL,
    status VARCHAR(20) NOT NULL,
    idempotency_key VARCHAR(64) NOT NULL,
    submitted_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    response_due_at DATETIME(6) NOT NULL,
    resolution_note VARCHAR(2000) NULL,
    processed_at DATETIME(6) NULL,
    processed_by BIGINT NULL,
    verification_note VARCHAR(500) NULL,
    CONSTRAINT uk_privacy_right_idempotency UNIQUE (user_id,idempotency_key),
    KEY idx_privacy_right_user (user_id,submitted_at),
    KEY idx_privacy_right_status (status,submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rollback: roll back the application binary only after preserving legal channels and honoring
-- WITHDRAWN decisions in the replacement version. Keep all three tables and their audit data.
-- A pre-migration snapshot must be retained. Do NOT drop tables containing consent/rights records.
-- A destructive schema downgrade requires a separately reviewed retention/export plan; not automated.
