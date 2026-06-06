-- 将 moment_images.image_data 从 VARCHAR(2048) 扩展为 MEDIUMTEXT
-- 支持存储 base64 编码的图片数据（最大 16MB）
ALTER TABLE moment_images MODIFY COLUMN image_data MEDIUMTEXT NOT NULL;
