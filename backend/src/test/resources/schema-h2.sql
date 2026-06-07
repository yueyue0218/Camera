-- H2-only schema supplement for tables managed by MyBatis-Plus (@TableName).
-- Hibernate create-drop handles all JPA @Entity tables automatically during tests.
-- Only tables annotated with @TableName (not managed by Hibernate) are defined here.
-- Current @TableName classes: ProviderProfile, RealNameCertification, AuditRecord.

CREATE TABLE IF NOT EXISTS provider_profiles (
    id                      BIGINT        AUTO_INCREMENT PRIMARY KEY,
    user_id                 BIGINT        NOT NULL,
    service_type            VARCHAR(40),
    display_name            VARCHAR(100),
    bio                     VARCHAR(500),
    city_code               VARCHAR(32),
    city_area               VARCHAR(64),
    price_min               DECIMAL(10,2),
    price_max               DECIMAL(10,2),
    accepting_orders        BOOLEAN,
    avg_rating              DECIMAL(3,2),
    completed_orders        INT           DEFAULT 0,
    audit_status            VARCHAR(20),
    age                     TINYINT,
    equipment               VARCHAR(500),
    provider_avatar_file_id BIGINT,
    created_at              TIMESTAMP,
    updated_at              TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_provider_profiles_user_id
    ON provider_profiles (user_id);

CREATE TABLE IF NOT EXISTS real_name_certifications (
    id                    BIGINT       AUTO_INCREMENT PRIMARY KEY,
    user_id               BIGINT       NOT NULL,
    real_name             VARCHAR(64),
    id_card_number        VARCHAR(50),
    id_card_front_file_id BIGINT,
    id_card_back_file_id  BIGINT,
    status                VARCHAR(20)  DEFAULT 'PENDING',
    reject_reason         VARCHAR(500),
    created_at            TIMESTAMP,
    reviewed_at           TIMESTAMP,
    reviewer_admin_id     BIGINT
);

CREATE INDEX IF NOT EXISTS idx_rnc_user_id
    ON real_name_certifications (user_id);

CREATE INDEX IF NOT EXISTS idx_rnc_status
    ON real_name_certifications (status);

CREATE TABLE IF NOT EXISTS audit_records (
    id          BIGINT      AUTO_INCREMENT PRIMARY KEY,
    target_type VARCHAR(50),
    target_id   BIGINT,
    admin_id    BIGINT,
    action      VARCHAR(20),
    reason      VARCHAR(500),
    created_at  TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_records_target
    ON audit_records (target_type, target_id);
