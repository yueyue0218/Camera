-- One-time migration: change disputes.refund_amount from DECIMAL to BIGINT.
-- Dispute.refundAmount is Java Long with no CentToYuanConverter,
-- so the column must be BIGINT (cents), not DECIMAL(10,2) (yuan).
-- Safe to run on databases where the column is already BIGINT (the IF check prevents re-execution).
-- BACKUP your database before running this script.

SET @col_type = (
    SELECT DATA_TYPE
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name   = 'disputes'
      AND column_name  = 'refund_amount'
);

SET @fix_sql = IF(
    @col_type = 'decimal',
    'ALTER TABLE `disputes` MODIFY COLUMN `refund_amount` BIGINT NULL COMMENT ''Unit: cents (Java Long, no CentToYuanConverter)''',
    'SELECT ''disputes.refund_amount is already BIGINT or disputes table does not exist'''
);

PREPARE fix_stmt FROM @fix_sql;
EXECUTE fix_stmt;
DEALLOCATE PREPARE fix_stmt;

SET @col_type = NULL;
SET @fix_sql  = NULL;
