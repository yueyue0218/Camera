-- A7 migration: add age and equipment columns to provider_profiles
-- Run once against camera_app database before deploying this version.

ALTER TABLE provider_profiles
    ADD COLUMN age       TINYINT UNSIGNED NULL     COMMENT '摄影师年龄',
    ADD COLUMN equipment VARCHAR(500)     NULL     COMMENT '常用摄影设备，如 Sony A7M4 + 85mm f/1.4';
