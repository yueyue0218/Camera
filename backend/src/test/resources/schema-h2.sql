-- H2-only schema supplement for tables managed by MyBatis/MyBatis-Plus.
-- Hibernate create-drop creates JPA entities during tests, but it does not
-- create @TableName tables such as provider_profiles.

CREATE TABLE IF NOT EXISTS provider_profiles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    service_type VARCHAR(50),
    display_name VARCHAR(64),
    bio VARCHAR(500),
    city_code VARCHAR(32),
    city_area VARCHAR(64),
    price_min DECIMAL(10,2),
    price_max DECIMAL(10,2),
    accepting_orders BOOLEAN,
    avg_rating DECIMAL(3,2),
    completed_orders INT,
    audit_status VARCHAR(20),
    age INT,
    equipment VARCHAR(500),
    provider_avatar_file_id BIGINT,
    certified_at TIMESTAMP,
    style_tags VARCHAR(200),
    price_per_hour DECIMAL(10,2),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_provider_profiles_user_id
    ON provider_profiles (user_id);
