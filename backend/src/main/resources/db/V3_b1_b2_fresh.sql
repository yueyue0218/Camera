-- V3 fresh init: service packages, demands, interests, demand responses.
-- Pure CREATE TABLE IF NOT EXISTS — no stored procedures, no UPDATE backfill.
-- Execute as step 3 of Path A (fresh database initialization).
-- For legacy migration from P3, use b1_b2_persistence.sql (Path B) instead.

CREATE TABLE IF NOT EXISTS service_packages (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    provider_id BIGINT NOT NULL,
    title VARCHAR(120) NOT NULL,
    city_code VARCHAR(40) NOT NULL,
    service_area VARCHAR(120) NULL,
    scene VARCHAR(80) NOT NULL,
    style_tags TEXT NOT NULL,
    images TEXT NOT NULL,
    base_price_cent BIGINT NOT NULL,
    price_range VARCHAR(120) NULL,
    duration_minutes INT NOT NULL,
    original_count INT NOT NULL,
    refined_count INT NOT NULL,
    delivery_days INT NOT NULL,
    available_dates TEXT NOT NULL,
    portfolio_ids TEXT NOT NULL,
    description TEXT NULL,
    time_description TEXT NOT NULL,
    time_tags TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ONLINE',
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    hidden_by_provider BOOLEAN NOT NULL DEFAULT FALSE,
    hidden_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_service_package_status (status),
    KEY idx_service_package_provider (provider_id, status),
    KEY idx_service_package_provider_hidden (provider_id, hidden_by_provider, updated_at),
    KEY idx_service_package_hall (status, city_code, scene, base_price_cent)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Provider service showcase packages';

CREATE TABLE IF NOT EXISTS demands (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    customer_id BIGINT NOT NULL,
    scene VARCHAR(80) NOT NULL,
    style_tags TEXT NOT NULL,
    expected_date DATE NULL,
    time_slot VARCHAR(80) NULL,
    time_description TEXT NOT NULL,
    time_tags TEXT NOT NULL,
    city_code VARCHAR(40) NOT NULL,
    location VARCHAR(255) NOT NULL,
    budget_min_cent INT NULL,
    budget_max_cent INT NULL,
    description TEXT NULL,
    reference_file_ids TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    response_count INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    expire_time DATETIME NULL,
    hidden_by_customer BOOLEAN NOT NULL DEFAULT FALSE,
    hidden_at DATETIME NULL,
    KEY idx_demands_hall (status, city_code, scene, expected_date),
    KEY idx_demands_budget_cent (budget_min_cent, budget_max_cent),
    KEY idx_demands_customer_status (customer_id, status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Customer demand hall posts';

CREATE TABLE IF NOT EXISTS service_package_interests (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    service_package_id BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_service_package_interest_user_package (user_id, service_package_id),
    KEY idx_service_package_interest_user (user_id, created_at),
    KEY idx_service_package_interest_package (service_package_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Customer interests in service showcase packages';

CREATE TABLE IF NOT EXISTS demand_responses (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    demand_id BIGINT NOT NULL,
    provider_user_id BIGINT NOT NULL,
    provider_profile_id BIGINT NOT NULL,
    message TEXT NOT NULL,
    expected_price_cent INT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_CUSTOMER_ACCEPT',
    reject_reason VARCHAR(255) NULL,
    response_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_demand_provider_response (demand_id, provider_user_id),
    KEY idx_response_provider_status (provider_user_id, status, response_time),
    KEY idx_response_demand_status (demand_id, status, response_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Provider responses to customer demands';
