-- Add gender/birthday/location fields to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS gender_visible   TINYINT(1) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS birthday         VARCHAR(20),
  ADD COLUMN IF NOT EXISTS birthday_visible TINYINT(1) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS location_display VARCHAR(100),
  ADD COLUMN IF NOT EXISTS location_visible TINYINT(1) DEFAULT 0;
