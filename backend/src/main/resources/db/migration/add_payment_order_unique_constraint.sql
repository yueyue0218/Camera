-- One-time migration for existing databases.
-- Preflight before applying:
-- SELECT order_id, COUNT(*) FROM payment_records GROUP BY order_id HAVING COUNT(*) > 1;
-- Resolve any duplicate rows against the authoritative payment provider record first.
-- The ALTER intentionally fails if duplicates still exist, rather than silently deleting money records.

ALTER TABLE payment_records
    ADD CONSTRAINT uk_payment_records_order_id UNIQUE (order_id);
