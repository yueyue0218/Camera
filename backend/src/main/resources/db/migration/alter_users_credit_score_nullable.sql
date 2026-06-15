-- One-time migration: make users.credit_score nullable for the "no real credit event yet" state.
-- Existing credit values are preserved; only the column nullability/default is changed.

ALTER TABLE users
    MODIFY credit_score DECIMAL(5,2) NULL DEFAULT NULL;
