-- MySQL 8 repeatable migration; review and apply manually. No production execution by this task.
-- Existing showcase intentions keep their IDs and API semantics.
SET @schema_name = DATABASE();
SET @sql = (SELECT IF(COUNT(*)=0,
 'ALTER TABLE service_package_interests ADD COLUMN target_type VARCHAR(20) NOT NULL DEFAULT ''SERVICE_PACKAGE''', 'SELECT 1')
 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='service_package_interests' AND COLUMN_NAME='target_type');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*)=0,
 'ALTER TABLE service_package_interests ADD COLUMN demand_id BIGINT NULL', 'SELECT 1')
 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='service_package_interests' AND COLUMN_NAME='demand_id');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
ALTER TABLE service_package_interests MODIFY COLUMN service_package_id BIGINT NULL;
SET @sql = (SELECT IF(COUNT(*)=0,
 'ALTER TABLE service_package_interests ADD UNIQUE KEY uk_interest_user_demand (user_id, demand_id)', 'SELECT 1')
 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='service_package_interests' AND INDEX_NAME='uk_interest_user_demand');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*)=0,
 'ALTER TABLE service_package_interests ADD KEY idx_interest_user_target_time (user_id, target_type, created_at, id)', 'SELECT 1')
 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='service_package_interests' AND INDEX_NAME='idx_interest_user_target_time');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
-- Rollback: roll application code back first. Keep the additive columns/indexes and nullable
-- service_package_id; old code reads only service_package_id targets. Do not DROP or DELETE
-- DEMAND records. Restoring NOT NULL requires an approved archive/export of those records.
