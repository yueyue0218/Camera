-- Apply to existing databases before deploying code that relies on quote/order idempotence.
-- Preflight: SELECT quote_id, COUNT(*) FROM orders GROUP BY quote_id HAVING COUNT(*) > 1;
-- Resolve any duplicates individually after checking their related messages and status history.
-- This intentionally fails when duplicate quote IDs remain; never delete rows automatically.

ALTER TABLE orders
    ADD CONSTRAINT uk_orders_quote_id UNIQUE (quote_id);
