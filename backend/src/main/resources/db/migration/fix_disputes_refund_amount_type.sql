-- One-time migration: change disputes.refund_amount from DECIMAL to BIGINT.
-- Dispute.refundAmount is Java Long with no CentToYuanConverter,
-- so the column must be BIGINT (cents), not DECIMAL(10,2) (yuan).
-- Safe to run on databases where the column is already BIGINT (the IF check prevents re-execution).
-- BACKUP your database before running this script.
--
-- 执行逻辑：
-- 1. 检测 refund_amount 列类型
-- 2. 若为 DECIMAL，检测是否存在小数部分（如 50.50 表示 50.50 元）
--    若存在：先 UPDATE refund_amount = ROUND(refund_amount * 100)，再 MODIFY 为 BIGINT
--    若不存在：只做 MODIFY，但操作员须人工确认整数值含义
--    （整数 DECIMAL 值如 100.00 无法自动区分"100 元"和"100 分"，需对照业务上下文判断）
-- 3. 若列已是 BIGINT 则跳过

-- Step 1：取列类型
SET @col_type = (
    SELECT DATA_TYPE FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name   = 'disputes'
      AND column_name  = 'refund_amount'
);

-- Step 2：若为 DECIMAL，检测是否有小数部分
SET @has_fractional = NULL;
SET @check_frac_sql = IF(
    @col_type = 'decimal',
    'SET @has_fractional = (SELECT COUNT(*) FROM `disputes` WHERE `refund_amount` IS NOT NULL AND `refund_amount` != FLOOR(`refund_amount`))',
    'SET @has_fractional = 0'
);
PREPARE check_stmt FROM @check_frac_sql;
EXECUTE check_stmt;
DEALLOCATE PREPARE check_stmt;

-- Step 3：若有小数部分，先乘以 100 回填（元 → 分）
SET @backfill_sql = IF(
    @col_type = 'decimal' AND @has_fractional > 0,
    'UPDATE `disputes` SET `refund_amount` = ROUND(`refund_amount` * 100) WHERE `refund_amount` IS NOT NULL',
    'SELECT ''No fractional values found; skipping backfill. Operator must manually verify integer values are already in cents.'''
);
PREPARE backfill_stmt FROM @backfill_sql;
EXECUTE backfill_stmt;
DEALLOCATE PREPARE backfill_stmt;

-- Step 4：MODIFY 列类型
SET @fix_sql = IF(
    @col_type = 'decimal',
    'ALTER TABLE `disputes` MODIFY COLUMN `refund_amount` BIGINT NULL COMMENT ''Unit: cents (Java Long, no CentToYuanConverter)''',
    'SELECT ''disputes.refund_amount is already BIGINT or column does not exist; no action taken.'''
);
PREPARE fix_stmt FROM @fix_sql;
EXECUTE fix_stmt;
DEALLOCATE PREPARE fix_stmt;

-- 清理变量
SET @col_type        = NULL;
SET @has_fractional  = NULL;
SET @check_frac_sql  = NULL;
SET @backfill_sql    = NULL;
SET @fix_sql         = NULL;
