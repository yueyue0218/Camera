-- 摄影师实名认证申请表
CREATE TABLE IF NOT EXISTS real_name_certifications
(
    id                    BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id               BIGINT       NOT NULL COMMENT '申请用户 ID',
    real_name             VARCHAR(50)  NOT NULL COMMENT '真实姓名',
    id_card_number        VARCHAR(50)  NOT NULL COMMENT '身份证号（脱敏：前3位明文+中间*+后4位明文）',
    id_card_front_file_id BIGINT       NOT NULL COMMENT '身份证正面文件 ID',
    id_card_back_file_id  BIGINT       NOT NULL COMMENT '身份证背面文件 ID',
    status                VARCHAR(20)  NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING / APPROVED / REJECTED',
    reject_reason         VARCHAR(500) COMMENT '拒绝原因',
    created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at           DATETIME COMMENT '审核时间',
    reviewer_admin_id     BIGINT COMMENT '审核管理员 ID',
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COMMENT = '摄影师实名认证申请';

-- 审核操作日志表
CREATE TABLE IF NOT EXISTS audit_records
(
    id          BIGINT PRIMARY KEY AUTO_INCREMENT,
    target_type VARCHAR(50)  NOT NULL COMMENT '审核目标类型，如 REAL_NAME_CERT',
    target_id   BIGINT       NOT NULL COMMENT '审核目标 ID',
    admin_id    BIGINT       NOT NULL COMMENT '操作管理员 ID',
    action      VARCHAR(20)  NOT NULL COMMENT 'APPROVE / REJECT',
    reason      VARCHAR(500) COMMENT '备注原因',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_target (target_type, target_id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COMMENT = '审核操作日志';

-- 摄影师档案表
CREATE TABLE IF NOT EXISTS provider_profiles
(
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id         BIGINT UNIQUE NOT NULL COMMENT '对应用户 ID',
    certified_at    DATETIME COMMENT '认证通过时间',
    bio             VARCHAR(500) COMMENT '个人简介',
    style_tags      VARCHAR(200) COMMENT '风格标签，逗号分隔',
    city_code       VARCHAR(32) COMMENT '所在城市',
    price_per_hour  DECIMAL(10, 2) COMMENT '每小时收费（元）',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COMMENT = '摄影师档案';
