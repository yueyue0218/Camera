-- Compatibility migration for databases created from docs/P3/04_建表SQL.sql.
-- Run once before deploying the unified real-name certification flow.

ALTER TABLE provider_profiles
    ADD COLUMN age       TINYINT UNSIGNED NULL COMMENT 'Provider age',
    ADD COLUMN equipment VARCHAR(500)     NULL COMMENT 'Common camera equipment';

ALTER TABLE real_name_certifications
    ADD COLUMN real_name         VARCHAR(50) NULL COMMENT 'Real name',
    ADD COLUMN id_card_number    VARCHAR(50) NULL COMMENT 'Masked ID card number',
    ADD COLUMN created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN reviewer_admin_id BIGINT NULL,
    MODIFY COLUMN real_name_masked  VARCHAR(64) NULL,
    MODIFY COLUMN id_card_no_cipher VARBINARY(512) NULL,
    MODIFY COLUMN id_card_no_hash   CHAR(64) NULL,
    MODIFY COLUMN id_card_no_masked VARCHAR(32) NULL,
    ADD KEY idx_cert_user_id (user_id),
    DROP INDEX uk_real_name_user;

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

ALTER TABLE audit_records
    ADD COLUMN target_type VARCHAR(50) NULL COMMENT 'Audit target type',
    ADD COLUMN action      VARCHAR(20) NULL COMMENT 'Audit action',
    ADD COLUMN reason      VARCHAR(500) NULL COMMENT 'Audit note',
    MODIFY COLUMN audit_type   VARCHAR(40) NULL,
    MODIFY COLUMN audit_result VARCHAR(30) NULL,
    ADD KEY idx_target (target_type, target_id);

UPDATE audit_records
SET target_type = COALESCE(target_type, audit_type),
    action      = COALESCE(action, audit_result),
    reason      = COALESCE(reason, remark);

ALTER TABLE audit_records
    MODIFY COLUMN target_type VARCHAR(50) NOT NULL COMMENT 'Audit target type',
    MODIFY COLUMN action      VARCHAR(20) NOT NULL COMMENT 'Audit action';
