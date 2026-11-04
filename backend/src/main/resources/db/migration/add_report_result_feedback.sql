-- MySQL 8 repeatable migration. No historical backfill or notification delivery.
SET @schema_name = DATABASE();
SET @sql = (SELECT IF(COUNT(*)=0,
 'ALTER TABLE reports ADD COLUMN public_message VARCHAR(200) NULL', 'SELECT 1')
 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='reports' AND COLUMN_NAME='public_message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(COUNT(*)=0,
 'ALTER TABLE reports ADD COLUMN follow_up_required TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1')
 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='reports' AND COLUMN_NAME='follow_up_required');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
