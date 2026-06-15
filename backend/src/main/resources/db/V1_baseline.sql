-- V1 baseline schema. Run this FIRST on a fresh database before any other script in this directory.
-- Requires MySQL 8.0+. Must be executed via mysql CLI or MySQL Workbench, not plain JDBC.
-- All money columns use DECIMAL(10,2) yuan to match the CentToYuanConverter pattern,
-- except disputes.refund_amount which is BIGINT (no converter in Dispute entity).

CREATE TABLE IF NOT EXISTS users (
    id             BIGINT         PRIMARY KEY AUTO_INCREMENT,
    student_no     VARCHAR(9)     NULL UNIQUE,
    password_hash  VARCHAR(100)   NULL,
    nickname       VARCHAR(64)    NOT NULL,
    school         VARCHAR(128)   NULL,
    avatar_file_id BIGINT         NULL,
    gender         VARCHAR(20)    NULL,
    city_code      VARCHAR(32)    NULL,
    bio            VARCHAR(500)   NULL,
    current_role   VARCHAR(20)    NOT NULL DEFAULT 'CUSTOMER',
    status         VARCHAR(20)    NOT NULL DEFAULT 'ACTIVE',
    credit_score   DECIMAL(5,2)   NULL DEFAULT NULL,
    created_at     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Platform users (students and providers)';

CREATE TABLE IF NOT EXISTS files (
    id            BIGINT        PRIMARY KEY AUTO_INCREMENT,
    uploader_id   BIGINT        NOT NULL,
    file_key      VARCHAR(255)  NOT NULL UNIQUE,
    original_name VARCHAR(255)  NOT NULL,
    mime_type     VARCHAR(100)  NOT NULL,
    file_size     BIGINT        NOT NULL,
    biz_type      VARCHAR(40)   NOT NULL,
    visibility    VARCHAR(20)   NOT NULL,
    url           VARCHAR(1024) NULL,
    checksum      VARCHAR(64)   NULL,
    created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_files_uploader (uploader_id),
    KEY idx_files_biz_type (biz_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Uploaded file records';

CREATE TABLE IF NOT EXISTS user_role_bindings (
    id         BIGINT      PRIMARY KEY AUTO_INCREMENT,
    user_id    BIGINT      NOT NULL,
    role       VARCHAR(20) NOT NULL,
    granted_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_role_binding (user_id, role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='User role assignments';

CREATE TABLE IF NOT EXISTS credit_records (
    id                   BIGINT        PRIMARY KEY AUTO_INCREMENT,
    user_id              BIGINT        NOT NULL,
    related_order_id     BIGINT        NULL,
    event_type           VARCHAR(40)   NOT NULL,
    score_change         INT           NOT NULL,
    before_score         DECIMAL(5,2)  NULL,
    score_after          DECIMAL(5,2)  NOT NULL,
    after_score          DECIMAL(5,2)  NULL,
    applied_score_change INT           NULL,
    source_type          VARCHAR(40)   NULL,
    source_id            BIGINT        NULL,
    reason               VARCHAR(1000) NULL,
    created_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_credit_records_source (source_type, source_id),
    KEY idx_credit_records_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='User credit score change records';

CREATE TABLE IF NOT EXISTS quotes (
    id                    BIGINT        PRIMARY KEY AUTO_INCREMENT,
    quote_no              VARCHAR(40)   NOT NULL UNIQUE,
    conversation_id       BIGINT        NOT NULL,
    provider_user_id      BIGINT        NOT NULL,
    customer_id           BIGINT        NOT NULL,
    shooting_plan_id      BIGINT        NULL,
    source_type           VARCHAR(40)   NOT NULL,
    source_id             BIGINT        NULL,
    total_amount          DECIMAL(10,2) NOT NULL,
    shoot_start_time      DATETIME      NOT NULL,
    shoot_end_time        DATETIME      NOT NULL,
    location              VARCHAR(500)  NOT NULL,
    service_content       TEXT          NULL,
    original_count        INT           NOT NULL DEFAULT 0,
    refined_count         INT           NOT NULL DEFAULT 0,
    delivery_deadline     DATETIME      NOT NULL,
    photo_usage_scope     VARCHAR(60)   NOT NULL DEFAULT 'PERSONAL_ONLY',
    terms                 TEXT          NULL,
    contract_terms        TEXT          NULL,
    safety_notice_version VARCHAR(40)   NULL,
    service_snapshot_json JSON          NOT NULL,
    status                VARCHAR(30)   NOT NULL DEFAULT 'PENDING_CONFIRM',
    expire_time           DATETIME      NOT NULL,
    created_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_quotes_conversation (conversation_id),
    KEY idx_quotes_provider_status (provider_user_id, status),
    KEY idx_quotes_customer_status (customer_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Provider quotes';

CREATE TABLE IF NOT EXISTS orders (
    id                      BIGINT        PRIMARY KEY AUTO_INCREMENT,
    order_no                VARCHAR(40)   NOT NULL UNIQUE,
    quote_id                BIGINT        NOT NULL,
    conversation_id         BIGINT        NOT NULL,
    customer_id             BIGINT        NOT NULL,
    provider_user_id        BIGINT        NOT NULL,
    demand_id               BIGINT        NULL,
    service_package_id      BIGINT        NULL,
    shooting_plan_id        BIGINT        NULL,
    status                  VARCHAR(40)   NOT NULL DEFAULT 'PENDING_PAYMENT',
    escrow_status           VARCHAR(30)   NOT NULL DEFAULT 'NOT_PAID',
    settlement_status       VARCHAR(30)   NOT NULL DEFAULT 'NOT_SETTLED',
    refund_status           VARCHAR(30)   NOT NULL DEFAULT 'NONE',
    total_amount            DECIMAL(10,2) NOT NULL,
    platform_fee            DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    provider_income         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    shoot_start_time        DATETIME      NOT NULL,
    shoot_end_time          DATETIME      NOT NULL,
    shoot_location          VARCHAR(500)  NOT NULL,
    delivery_deadline       DATETIME      NOT NULL,
    photo_usage_scope       VARCHAR(60)   NOT NULL DEFAULT 'PERSONAL_ONLY',
    quote_snapshot_json     JSON          NOT NULL,
    safety_notice_confirmed BOOLEAN       NOT NULL DEFAULT FALSE,
    contract_terms          TEXT          NULL,
    auto_confirm_time       DATETIME      NULL,
    complete_time           DATETIME      NULL,
    cancel_time             DATETIME      NULL,
    created_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_orders_customer_status (customer_id, status),
    KEY idx_orders_provider_status (provider_user_id, status),
    KEY idx_orders_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Confirmed shooting orders';

CREATE TABLE IF NOT EXISTS order_status_logs (
    id            BIGINT      PRIMARY KEY AUTO_INCREMENT,
    order_id      BIGINT      NOT NULL,
    from_status   VARCHAR(40) NULL,
    to_status     VARCHAR(40) NOT NULL,
    operator_id   BIGINT      NULL,
    operator_role VARCHAR(20) NULL,
    remark        TEXT        NULL,
    created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_order_status_logs_order (order_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Order status transition logs';

CREATE TABLE IF NOT EXISTS payment_records (
    id                   BIGINT        PRIMARY KEY AUTO_INCREMENT,
    payment_no           VARCHAR(40)   NOT NULL UNIQUE,
    order_id             BIGINT        NOT NULL,
    third_party_trade_no VARCHAR(80)   NULL,
    amount               DECIMAL(10,2) NOT NULL,
    refund_amount        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    pay_method           VARCHAR(30)   NOT NULL,
    status               VARCHAR(30)   NOT NULL,
    requested_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at              DATETIME      NULL,
    refunded_at          DATETIME      NULL,
    KEY idx_payment_records_order (order_id),
    KEY idx_payment_records_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Payment and refund records';

CREATE TABLE IF NOT EXISTS disputes (
    id             BIGINT        PRIMARY KEY AUTO_INCREMENT,
    order_id       BIGINT        NOT NULL,
    initiator_id   BIGINT        NOT NULL,
    reason         VARCHAR(1000) NOT NULL,
    status         VARCHAR(20)   NOT NULL DEFAULT 'OPEN',
    resolution     VARCHAR(30)   NULL,
    responsibility VARCHAR(30)   NULL,
    refund_amount  BIGINT        NULL COMMENT 'Unit: cents (Java Long, no CentToYuanConverter)',
    admin_id       BIGINT        NULL,
    admin_comment  TEXT          NULL,
    created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    resolved_at    DATETIME      NULL,
    KEY idx_disputes_order (order_id),
    KEY idx_disputes_initiator_status (initiator_id, status),
    KEY idx_disputes_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Order disputes';

CREATE TABLE IF NOT EXISTS dispute_replies (
    id         BIGINT        PRIMARY KEY AUTO_INCREMENT,
    dispute_id BIGINT        NOT NULL,
    replier_id BIGINT        NOT NULL,
    content    VARCHAR(2000) NOT NULL,
    created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_dispute_replies_dispute (dispute_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Dispute reply threads';

CREATE TABLE IF NOT EXISTS deliveries (
    id                    BIGINT      PRIMARY KEY AUTO_INCREMENT,
    order_id              BIGINT      NOT NULL,
    delivery_round        INT         NOT NULL DEFAULT 1,
    is_latest             BOOLEAN     NOT NULL DEFAULT TRUE,
    original_count        INT         NULL,
    refined_count         INT         NULL,
    deadline              DATETIME    NULL,
    status                VARCHAR(30) NOT NULL DEFAULT 'PENDING_UPLOAD',
    remark                TEXT        NULL,
    upload_time           DATETIME    NULL,
    confirm_time          DATETIME    NULL,
    auto_confirm_deadline DATETIME    NULL,
    KEY idx_deliveries_order (order_id, is_latest)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Photo delivery batches';

CREATE TABLE IF NOT EXISTS delivery_files (
    id          BIGINT      PRIMARY KEY AUTO_INCREMENT,
    delivery_id BIGINT      NOT NULL,
    file_id     BIGINT      NOT NULL,
    file_type   VARCHAR(30) NULL,
    sort_order  INT         NOT NULL DEFAULT 0,
    upload_time DATETIME    NULL,
    KEY idx_delivery_files_delivery (delivery_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Files attached to a delivery batch';

CREATE TABLE IF NOT EXISTS photo_authorizations (
    id               BIGINT      PRIMARY KEY AUTO_INCREMENT,
    order_id         BIGINT      NOT NULL,
    customer_id      BIGINT      NOT NULL,
    provider_user_id BIGINT      NOT NULL,
    photo_usage_scope VARCHAR(60) NOT NULL DEFAULT 'PORTFOLIO_DISPLAY',
    status           VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    remark           TEXT        NULL,
    authorized_at    DATETIME    NULL,
    expire_time      DATETIME    NULL,
    KEY idx_photo_auth_order (order_id),
    KEY idx_photo_auth_provider_status (provider_user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Photo usage authorization by customer to provider';

CREATE TABLE IF NOT EXISTS photo_authorization_files (
    id               BIGINT PRIMARY KEY AUTO_INCREMENT,
    authorization_id BIGINT NOT NULL,
    file_id          BIGINT NOT NULL,
    sort_order       INT    NOT NULL DEFAULT 0,
    KEY idx_photo_auth_files_auth (authorization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Files covered by a photo authorization';

CREATE TABLE IF NOT EXISTS student_certifications (
    id                   BIGINT         PRIMARY KEY AUTO_INCREMENT,
    user_id              BIGINT         NOT NULL,
    real_name_masked     VARCHAR(64)    NOT NULL,
    student_no_cipher    VARBINARY(512) NULL,
    student_no_hash      VARCHAR(64)    NULL,
    university           VARCHAR(128)   NOT NULL,
    student_card_file_id BIGINT         NOT NULL,
    status               VARCHAR(30)    NOT NULL DEFAULT 'PENDING_REVIEW',
    reject_reason        VARCHAR(255)   NULL,
    applied_at           DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at          DATETIME       NULL,
    reviewer_id          BIGINT         NULL,
    KEY idx_student_cert_user (user_id),
    KEY idx_student_cert_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Student identity certifications';
