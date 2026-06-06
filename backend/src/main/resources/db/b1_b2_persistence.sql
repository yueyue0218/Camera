-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- WARNING: This script contains UPDATE backfill statements.
-- BACKUP YOUR DATABASE before executing.
-- This script is ONE-TIME ONLY for migrating legacy databases.
-- Do NOT execute on a fresh database initialized from V1_baseline.sql.
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- B1/B2 persistence migration.
-- Aligns ServicePackage, Demand, and DemandResponse JPA entities with real MySQL tables.

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

DELIMITER //

DROP PROCEDURE IF EXISTS b1b2_add_column_if_missing//
CREATE PROCEDURE b1b2_add_column_if_missing(
    IN p_table_name VARCHAR(64),
    IN p_column_name VARCHAR(64),
    IN p_column_definition TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = p_table_name
          AND column_name = p_column_name
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', p_table_name, '` ADD COLUMN ', p_column_definition);
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END//

DROP PROCEDURE IF EXISTS b1b2_modify_column_if_exists//
CREATE PROCEDURE b1b2_modify_column_if_exists(
    IN p_table_name VARCHAR(64),
    IN p_column_name VARCHAR(64),
    IN p_column_definition TEXT
)
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = p_table_name
          AND column_name = p_column_name
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', p_table_name, '` MODIFY COLUMN ', p_column_definition);
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END//

DROP PROCEDURE IF EXISTS b1b2_add_index_if_missing//
CREATE PROCEDURE b1b2_add_index_if_missing(
    IN p_table_name VARCHAR(64),
    IN p_index_name VARCHAR(64),
    IN p_index_definition TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = p_table_name
          AND index_name = p_index_name
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', p_table_name, '` ADD ', p_index_definition);
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END//

DROP PROCEDURE IF EXISTS b1b2_exec_if_tables_exist//
CREATE PROCEDURE b1b2_exec_if_tables_exist(
    IN p_table_one VARCHAR(64),
    IN p_table_two VARCHAR(64),
    IN p_table_three VARCHAR(64),
    IN p_sql TEXT
)
BEGIN
    IF (p_table_one = '' OR EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = DATABASE() AND table_name = p_table_one
        ))
       AND (p_table_two = '' OR EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = DATABASE() AND table_name = p_table_two
        ))
       AND (p_table_three = '' OR EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = DATABASE() AND table_name = p_table_three
        )) THEN
        SET @ddl = p_sql;
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END//

DROP PROCEDURE IF EXISTS b1b2_exec_if_columns_exist//
CREATE PROCEDURE b1b2_exec_if_columns_exist(
    IN p_table_name VARCHAR(64),
    IN p_column_one VARCHAR(64),
    IN p_column_two VARCHAR(64),
    IN p_column_three VARCHAR(64),
    IN p_sql TEXT
)
BEGIN
    IF (p_column_one = '' OR EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = p_table_name AND column_name = p_column_one
        ))
       AND (p_column_two = '' OR EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = p_table_name AND column_name = p_column_two
        ))
       AND (p_column_three = '' OR EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = p_table_name AND column_name = p_column_three
        )) THEN
        SET @ddl = p_sql;
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END//

DELIMITER ;

CALL b1b2_add_column_if_missing('service_packages', 'provider_id', 'provider_id BIGINT NULL');
CALL b1b2_add_column_if_missing('service_packages', 'service_area', 'service_area VARCHAR(120) NULL');
CALL b1b2_add_column_if_missing('service_packages', 'style_tags', 'style_tags TEXT NULL');
CALL b1b2_add_column_if_missing('service_packages', 'images', 'images TEXT NULL');
CALL b1b2_add_column_if_missing('service_packages', 'base_price_cent', 'base_price_cent BIGINT NULL');
CALL b1b2_add_column_if_missing('service_packages', 'price_range', 'price_range VARCHAR(120) NULL');
CALL b1b2_add_column_if_missing('service_packages', 'available_dates', 'available_dates TEXT NULL');
CALL b1b2_add_column_if_missing('service_packages', 'portfolio_ids', 'portfolio_ids TEXT NULL');
CALL b1b2_add_column_if_missing('service_packages', 'time_description', 'time_description TEXT NULL');
CALL b1b2_add_column_if_missing('service_packages', 'time_tags', 'time_tags TEXT NULL');
CALL b1b2_add_column_if_missing('service_packages', 'is_available', 'is_available BOOLEAN NULL');
CALL b1b2_add_column_if_missing('service_packages', 'hidden_by_provider', 'hidden_by_provider BOOLEAN NULL');
CALL b1b2_add_column_if_missing('service_packages', 'hidden_at', 'hidden_at DATETIME NULL');

CALL b1b2_exec_if_columns_exist(
    'service_packages', 'provider_id', 'provider_user_id', '',
    'UPDATE service_packages SET provider_id = provider_user_id WHERE provider_id IS NULL AND provider_user_id IS NOT NULL'
);
CALL b1b2_exec_if_columns_exist(
    'service_packages', 'service_area', 'location_note', '',
    'UPDATE service_packages SET service_area = location_note WHERE service_area IS NULL AND location_note IS NOT NULL'
);
CALL b1b2_exec_if_columns_exist(
    'service_packages', 'base_price_cent', 'base_price', '',
    'UPDATE service_packages SET base_price_cent = ROUND(base_price * 100) WHERE base_price_cent IS NULL AND base_price IS NOT NULL'
);
CALL b1b2_exec_if_tables_exist(
    'service_packages', 'service_package_tags', 'style_tags',
    'UPDATE service_packages sp SET sp.style_tags = COALESCE((SELECT JSON_ARRAYAGG(st.name) FROM service_package_tags spt JOIN style_tags st ON st.id = spt.tag_id WHERE spt.service_package_id = sp.id), JSON_ARRAY()) WHERE sp.style_tags IS NULL'
);
CALL b1b2_exec_if_tables_exist(
    'service_packages', 'service_package_available_dates', '',
    'UPDATE service_packages sp SET sp.available_dates = COALESCE((SELECT JSON_ARRAYAGG(DATE_FORMAT(spad.available_date, ''%Y-%m-%d'')) FROM service_package_available_dates spad WHERE spad.service_package_id = sp.id AND spad.status = ''AVAILABLE''), JSON_ARRAY()) WHERE sp.available_dates IS NULL'
);

UPDATE service_packages SET style_tags = '[]' WHERE style_tags IS NULL;
UPDATE service_packages SET images = portfolio_ids WHERE images IS NULL AND portfolio_ids IS NOT NULL;
UPDATE service_packages SET images = '[]' WHERE images IS NULL;
UPDATE service_packages SET available_dates = '[]' WHERE available_dates IS NULL;
UPDATE service_packages SET portfolio_ids = '[]' WHERE portfolio_ids IS NULL;
UPDATE service_packages
SET time_description = COALESCE(NULLIF(time_description, ''), NULLIF(available_dates, '[]'), title)
WHERE time_description IS NULL OR time_description = '';
UPDATE service_packages SET time_tags = '[]' WHERE time_tags IS NULL;
UPDATE service_packages SET is_available = (status = 'ONLINE') WHERE is_available IS NULL;
UPDATE service_packages SET hidden_by_provider = FALSE WHERE hidden_by_provider IS NULL;

CALL b1b2_modify_column_if_exists('service_packages', 'provider_profile_id', 'provider_profile_id BIGINT NULL');
CALL b1b2_modify_column_if_exists('service_packages', 'provider_user_id', 'provider_user_id BIGINT NULL');
CALL b1b2_modify_column_if_exists('service_packages', 'package_no', 'package_no VARCHAR(40) NULL');
CALL b1b2_modify_column_if_exists('service_packages', 'base_price', 'base_price DECIMAL(10,2) NULL');
CALL b1b2_modify_column_if_exists('service_packages', 'min_participants', 'min_participants INT NULL');
CALL b1b2_modify_column_if_exists('service_packages', 'max_participants', 'max_participants INT NULL');
CALL b1b2_modify_column_if_exists('service_packages', 'title', 'title VARCHAR(120) NOT NULL');
CALL b1b2_modify_column_if_exists('service_packages', 'city_code', 'city_code VARCHAR(40) NOT NULL');
CALL b1b2_modify_column_if_exists('service_packages', 'scene', 'scene VARCHAR(80) NOT NULL');
CALL b1b2_modify_column_if_exists('service_packages', 'style_tags', 'style_tags TEXT NOT NULL');
CALL b1b2_modify_column_if_exists('service_packages', 'images', 'images TEXT NOT NULL');
CALL b1b2_modify_column_if_exists('service_packages', 'available_dates', 'available_dates TEXT NOT NULL');
CALL b1b2_modify_column_if_exists('service_packages', 'portfolio_ids', 'portfolio_ids TEXT NOT NULL');
CALL b1b2_modify_column_if_exists('service_packages', 'time_description', 'time_description TEXT NOT NULL');
CALL b1b2_modify_column_if_exists('service_packages', 'time_tags', 'time_tags TEXT NOT NULL');
CALL b1b2_modify_column_if_exists('service_packages', 'is_available', 'is_available BOOLEAN NOT NULL DEFAULT TRUE');
CALL b1b2_modify_column_if_exists('service_packages', 'hidden_by_provider', 'hidden_by_provider BOOLEAN NOT NULL DEFAULT FALSE');

CALL b1b2_add_index_if_missing('service_packages', 'idx_service_package_status', 'INDEX idx_service_package_status (status)');
CALL b1b2_add_index_if_missing('service_packages', 'idx_service_package_provider', 'INDEX idx_service_package_provider (provider_id, status)');
CALL b1b2_add_index_if_missing('service_packages', 'idx_service_package_provider_hidden', 'INDEX idx_service_package_provider_hidden (provider_id, hidden_by_provider, updated_at)');
CALL b1b2_add_index_if_missing('service_packages', 'idx_service_package_hall', 'INDEX idx_service_package_hall (status, city_code, scene, base_price_cent)');

CALL b1b2_add_column_if_missing('demands', 'style_tags', 'style_tags TEXT NULL');
CALL b1b2_add_column_if_missing('demands', 'time_description', 'time_description TEXT NULL');
CALL b1b2_add_column_if_missing('demands', 'time_tags', 'time_tags TEXT NULL');
CALL b1b2_add_column_if_missing('demands', 'budget_min_cent', 'budget_min_cent INT NULL');
CALL b1b2_add_column_if_missing('demands', 'budget_max_cent', 'budget_max_cent INT NULL');
CALL b1b2_add_column_if_missing('demands', 'reference_file_ids', 'reference_file_ids TEXT NULL');
CALL b1b2_add_column_if_missing('demands', 'hidden_by_customer', 'hidden_by_customer BOOLEAN NULL');
CALL b1b2_add_column_if_missing('demands', 'hidden_at', 'hidden_at DATETIME NULL');

CALL b1b2_exec_if_columns_exist(
    'demands', 'budget_min_cent', 'budget_min', '',
    'UPDATE demands SET budget_min_cent = ROUND(budget_min * 100) WHERE budget_min_cent IS NULL AND budget_min IS NOT NULL'
);
CALL b1b2_exec_if_columns_exist(
    'demands', 'budget_max_cent', 'budget_max', '',
    'UPDATE demands SET budget_max_cent = ROUND(budget_max * 100) WHERE budget_max_cent IS NULL AND budget_max IS NOT NULL'
);
CALL b1b2_exec_if_tables_exist(
    'demands', 'demand_style_tags', 'style_tags',
    'UPDATE demands d SET d.style_tags = COALESCE((SELECT JSON_ARRAYAGG(st.name) FROM demand_style_tags dst JOIN style_tags st ON st.id = dst.tag_id WHERE dst.demand_id = d.id), JSON_ARRAY()) WHERE d.style_tags IS NULL'
);
CALL b1b2_exec_if_tables_exist(
    'demands', 'demand_reference_files', '',
    'UPDATE demands d SET d.reference_file_ids = COALESCE((SELECT JSON_ARRAYAGG(drf.file_id) FROM demand_reference_files drf WHERE drf.demand_id = d.id), JSON_ARRAY()) WHERE d.reference_file_ids IS NULL'
);

UPDATE demands SET style_tags = '[]' WHERE style_tags IS NULL;
UPDATE demands
SET time_description = COALESCE(NULLIF(time_description, ''), NULLIF(time_slot, ''), DATE_FORMAT(expected_date, '%Y-%m-%d'), description, scene)
WHERE time_description IS NULL OR time_description = '';
UPDATE demands SET time_tags = '[]' WHERE time_tags IS NULL;
UPDATE demands SET reference_file_ids = '[]' WHERE reference_file_ids IS NULL;
UPDATE demands SET hidden_by_customer = FALSE WHERE hidden_by_customer IS NULL;

CALL b1b2_modify_column_if_exists('demands', 'style_tags', 'style_tags TEXT NOT NULL');
CALL b1b2_modify_column_if_exists('demands', 'time_description', 'time_description TEXT NOT NULL');
CALL b1b2_modify_column_if_exists('demands', 'time_tags', 'time_tags TEXT NOT NULL');
CALL b1b2_modify_column_if_exists('demands', 'reference_file_ids', 'reference_file_ids TEXT NOT NULL');
CALL b1b2_modify_column_if_exists('demands', 'hidden_by_customer', 'hidden_by_customer BOOLEAN NOT NULL DEFAULT FALSE');
CALL b1b2_modify_column_if_exists('demands', 'scene', 'scene VARCHAR(80) NOT NULL');
CALL b1b2_modify_column_if_exists('demands', 'city_code', 'city_code VARCHAR(40) NOT NULL');
CALL b1b2_add_index_if_missing('demands', 'idx_demands_budget_cent', 'INDEX idx_demands_budget_cent (budget_min_cent, budget_max_cent)');

CALL b1b2_add_column_if_missing('demand_responses', 'expected_price_cent', 'expected_price_cent INT NULL');
CALL b1b2_exec_if_columns_exist(
    'demand_responses', 'expected_price_cent', 'expected_price', '',
    'UPDATE demand_responses SET expected_price_cent = ROUND(expected_price * 100) WHERE expected_price_cent IS NULL AND expected_price IS NOT NULL'
);

DROP PROCEDURE IF EXISTS b1b2_exec_if_columns_exist;
DROP PROCEDURE IF EXISTS b1b2_exec_if_tables_exist;
DROP PROCEDURE IF EXISTS b1b2_add_index_if_missing;
DROP PROCEDURE IF EXISTS b1b2_modify_column_if_exists;
DROP PROCEDURE IF EXISTS b1b2_add_column_if_missing;
