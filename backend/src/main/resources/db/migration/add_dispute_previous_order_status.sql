-- One-time migration for existing databases.
-- The status log written when an order entered APPEALING is the authoritative
-- source for disputes created before previous_order_status was persisted.

ALTER TABLE disputes
    ADD COLUMN previous_order_status VARCHAR(40) NULL AFTER initiator_id;

UPDATE disputes d
SET d.previous_order_status = (
    SELECT osl.from_status
    FROM order_status_logs osl
    WHERE osl.order_id = d.order_id
      AND osl.to_status = 'APPEALING'
      AND osl.created_at <= d.created_at
    ORDER BY osl.created_at DESC, osl.id DESC
    LIMIT 1
)
WHERE d.previous_order_status IS NULL;

-- Inspect and repair any rows returned here before applying the final ALTER.
SELECT id, order_id
FROM disputes
WHERE previous_order_status IS NULL;

ALTER TABLE disputes
    MODIFY COLUMN previous_order_status VARCHAR(40) NOT NULL;
