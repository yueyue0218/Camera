-- Account cancellation requests are retained separately from the user record so
-- a request can be audited without deleting order or dispute evidence.
CREATE TABLE IF NOT EXISTS account_cancellation_requests (
    id               BIGINT       PRIMARY KEY AUTO_INCREMENT,
    user_id          BIGINT       NOT NULL,
    status           VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    reason           VARCHAR(500) NULL,
    requested_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    processed_at     DATETIME     NULL,
    resolution_note  VARCHAR(500) NULL,
    CONSTRAINT uk_account_cancellation_user UNIQUE (user_id),
    KEY idx_account_cancellation_status_requested (status, requested_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='User account cancellation requests and review status';
