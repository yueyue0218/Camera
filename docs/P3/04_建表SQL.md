# Camera 约拍服务平台 — 建表 SQL

```sql
CREATE DATABASE IF NOT EXISTS camera_app
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE camera_app;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  mobile_cipher VARBINARY(512) NULL COMMENT 'Encrypted phone number; plaintext phone is forbidden',
  mobile_hash CHAR(64) NULL COMMENT 'SHA-256/HMAC hash for login lookup and uniqueness',
  mobile_masked VARCHAR(32) NULL COMMENT 'Masked display value such as 138****1234',
  password_hash VARCHAR(100) NULL COMMENT 'BCrypt hash only; null when using pure third party login',
  nickname VARCHAR(64) NOT NULL,
  avatar_file_id BIGINT NULL,
  gender VARCHAR(20) NULL,
  city_code VARCHAR(32) NULL,
  school VARCHAR(128) NULL,
  bio VARCHAR(500) NULL,
  current_role VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  credit_score DECIMAL(5,2) NOT NULL DEFAULT 80.00,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_users_mobile_hash (mobile_hash),
  KEY idx_users_role_status (current_role, status),
  KEY idx_users_city (city_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Users with multi-role support';

CREATE TABLE user_role_bindings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  role VARCHAR(20) NOT NULL,
  granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_role (user_id, role),
  CONSTRAINT fk_user_role_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Roles owned by a user';

CREATE TABLE files (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  uploader_id BIGINT NOT NULL,
  file_key VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  biz_type VARCHAR(40) NOT NULL COMMENT 'AVATAR/PORTFOLIO/ID_CARD/STUDENT_CARD/DEMAND_REFERENCE/DELIVERY/APPEAL_EVIDENCE/REVIEW',
  visibility VARCHAR(20) NOT NULL COMMENT 'PUBLIC/PRIVATE',
  url VARCHAR(1024) NULL COMMENT 'Permanent public URL or internal object URL',
  checksum CHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_files_file_key (file_key),
  KEY idx_files_uploader_time (uploader_id, created_at),
  KEY idx_files_biz_visibility (biz_type, visibility),
  CONSTRAINT fk_files_uploader FOREIGN KEY (uploader_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='File metadata; binary content is stored outside MySQL';

ALTER TABLE users
  ADD CONSTRAINT fk_users_avatar_file FOREIGN KEY (avatar_file_id) REFERENCES files(id);

CREATE TABLE student_certifications (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  real_name_masked VARCHAR(64) NOT NULL,
  student_no_cipher VARBINARY(512) NULL,
  student_no_hash CHAR(64) NULL,
  university VARCHAR(128) NOT NULL,
  student_card_file_id BIGINT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW',
  reject_reason VARCHAR(255) NULL,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  reviewer_id BIGINT NULL,
  UNIQUE KEY uk_student_cert_user (user_id),
  KEY idx_student_cert_status (status, applied_at),
  CONSTRAINT fk_student_cert_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_student_cert_file FOREIGN KEY (student_card_file_id) REFERENCES files(id),
  CONSTRAINT fk_student_cert_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Optional student certification';

CREATE TABLE real_name_certifications (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  real_name_masked VARCHAR(64) NOT NULL,
  id_card_no_cipher VARBINARY(512) NOT NULL,
  id_card_no_hash CHAR(64) NOT NULL,
  id_card_no_masked VARCHAR(32) NOT NULL,
  id_card_front_file_id BIGINT NOT NULL,
  id_card_back_file_id BIGINT NOT NULL,
  face_verify_result VARCHAR(40) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW',
  reject_reason VARCHAR(255) NULL,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  reviewer_id BIGINT NULL,
  UNIQUE KEY uk_real_name_user (user_id),
  UNIQUE KEY uk_real_name_id_hash (id_card_no_hash),
  KEY idx_real_name_status (status, applied_at),
  CONSTRAINT fk_real_name_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_real_name_front_file FOREIGN KEY (id_card_front_file_id) REFERENCES files(id),
  CONSTRAINT fk_real_name_back_file FOREIGN KEY (id_card_back_file_id) REFERENCES files(id),
  CONSTRAINT fk_real_name_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Provider real-name certification';

CREATE TABLE provider_profiles (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  service_type VARCHAR(30) NOT NULL DEFAULT 'PHOTOGRAPHER',
  display_name VARCHAR(80) NOT NULL,
  bio TEXT NULL,
  city_code VARCHAR(32) NOT NULL,
  city_area VARCHAR(255) NULL,
  price_min DECIMAL(10,2) NULL,
  price_max DECIMAL(10,2) NULL,
  accepting_orders BOOLEAN NOT NULL DEFAULT FALSE,
  avg_rating DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  completed_orders INT NOT NULL DEFAULT 0,
  audit_status VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_provider_profile_user (user_id),
  KEY idx_provider_search (city_code, accepting_orders, audit_status, avg_rating),
  KEY idx_provider_price (price_min, price_max),
  CONSTRAINT fk_provider_profile_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Provider homepage profile';

CREATE TABLE style_tags (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(40) NOT NULL,
  category VARCHAR(40) NOT NULL DEFAULT 'STYLE',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uk_style_tag_name (name),
  KEY idx_style_tag_category (category, enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Style, scene and searchable tags';

CREATE TABLE provider_style_tags (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  provider_profile_id BIGINT NOT NULL,
  tag_id BIGINT NOT NULL,
  UNIQUE KEY uk_provider_style_tag (provider_profile_id, tag_id),
  CONSTRAINT fk_provider_style_profile FOREIGN KEY (provider_profile_id) REFERENCES provider_profiles(id),
  CONSTRAINT fk_provider_style_tag FOREIGN KEY (tag_id) REFERENCES style_tags(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Provider style tags';

CREATE TABLE service_packages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  provider_profile_id BIGINT NOT NULL,
  provider_user_id BIGINT NOT NULL,
  cover_file_id BIGINT NULL,
  package_no VARCHAR(40) NOT NULL,
  title VARCHAR(100) NOT NULL,
  scene VARCHAR(40) NOT NULL,
  base_price DECIMAL(10,2) NOT NULL,
  duration_minutes INT NOT NULL,
  original_count INT NOT NULL,
  refined_count INT NOT NULL,
  delivery_days INT NOT NULL,
  city_code VARCHAR(32) NOT NULL,
  location_note VARCHAR(255) NULL,
  min_participants INT NOT NULL DEFAULT 1,
  max_participants INT NOT NULL DEFAULT 1,
  included_items TEXT NULL,
  booking_notice TEXT NULL,
  description TEXT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_service_package_no (package_no),
  KEY idx_service_provider_status (provider_profile_id, status),
  KEY idx_service_hall (status, city_code, scene, base_price),
  KEY idx_service_provider_user (provider_user_id, status),
  CONSTRAINT fk_service_profile FOREIGN KEY (provider_profile_id) REFERENCES provider_profiles(id),
  CONSTRAINT fk_service_provider_user FOREIGN KEY (provider_user_id) REFERENCES users(id),
  CONSTRAINT fk_service_cover_file FOREIGN KEY (cover_file_id) REFERENCES files(id),
  CONSTRAINT ck_service_price CHECK (base_price >= 0),
  CONSTRAINT ck_service_counts CHECK (original_count >= 0 AND refined_count >= 0),
  CONSTRAINT ck_service_participants CHECK (min_participants >= 1 AND max_participants >= min_participants)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Provider service showcase packages';

CREATE TABLE service_package_tags (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  service_package_id BIGINT NOT NULL,
  tag_id BIGINT NOT NULL,
  UNIQUE KEY uk_service_package_tag (service_package_id, tag_id),
  CONSTRAINT fk_service_tag_package FOREIGN KEY (service_package_id) REFERENCES service_packages(id),
  CONSTRAINT fk_service_tag_tag FOREIGN KEY (tag_id) REFERENCES style_tags(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Service package tags';

CREATE TABLE service_package_available_dates (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  service_package_id BIGINT NOT NULL,
  available_date DATE NOT NULL,
  time_slot VARCHAR(80) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
  UNIQUE KEY uk_service_available_date (service_package_id, available_date, time_slot),
  KEY idx_available_date (available_date, status),
  CONSTRAINT fk_service_available_package FOREIGN KEY (service_package_id) REFERENCES service_packages(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Available dates exposed in service hall';

CREATE TABLE shooting_plan_templates (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  scene VARCHAR(40) NOT NULL,
  title VARCHAR(100) NOT NULL,
  template_schema JSON NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_plan_template_scene (scene, enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Standardized shooting plan templates';

CREATE TABLE shooting_plans (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  template_id BIGINT NULL,
  customer_id BIGINT NOT NULL,
  scene VARCHAR(40) NOT NULL,
  style_preference VARCHAR(255) NULL,
  makeup_requirement VARCHAR(255) NULL,
  outfit_requirement VARCHAR(255) NULL,
  pose_reference TEXT NULL,
  prop_requirement TEXT NULL,
  plan_detail JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_shooting_plan_customer (customer_id, created_at),
  CONSTRAINT fk_shooting_plan_template FOREIGN KEY (template_id) REFERENCES shooting_plan_templates(id),
  CONSTRAINT fk_shooting_plan_customer FOREIGN KEY (customer_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Concrete shooting plan filled by customer';

CREATE TABLE demands (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  customer_id BIGINT NOT NULL,
  shooting_plan_id BIGINT NULL,
  scene VARCHAR(40) NOT NULL,
  expected_date DATE NULL,
  time_slot VARCHAR(80) NULL,
  city_code VARCHAR(32) NOT NULL,
  location VARCHAR(255) NOT NULL,
  budget_range VARCHAR(40) NULL,
  budget_min DECIMAL(10,2) NULL,
  budget_max DECIMAL(10,2) NULL,
  description TEXT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
  response_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  expire_time DATETIME NULL,
  KEY idx_demands_hall (status, city_code, scene, expected_date),
  KEY idx_demands_budget (budget_min, budget_max),
  KEY idx_demands_customer_status (customer_id, status, created_at),
  CONSTRAINT fk_demand_customer FOREIGN KEY (customer_id) REFERENCES users(id),
  CONSTRAINT fk_demand_plan FOREIGN KEY (shooting_plan_id) REFERENCES shooting_plans(id),
  CONSTRAINT ck_demand_budget CHECK (budget_min IS NULL OR budget_max IS NULL OR budget_max >= budget_min)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Customer demand hall posts';

CREATE TABLE demand_style_tags (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  demand_id BIGINT NOT NULL,
  tag_id BIGINT NOT NULL,
  UNIQUE KEY uk_demand_style_tag (demand_id, tag_id),
  CONSTRAINT fk_demand_style_demand FOREIGN KEY (demand_id) REFERENCES demands(id),
  CONSTRAINT fk_demand_style_tag FOREIGN KEY (tag_id) REFERENCES style_tags(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Demand style tags';

CREATE TABLE demand_reference_files (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  demand_id BIGINT NOT NULL,
  file_id BIGINT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_demand_reference_file (demand_id, file_id),
  CONSTRAINT fk_demand_reference_demand FOREIGN KEY (demand_id) REFERENCES demands(id),
  CONSTRAINT fk_demand_reference_file FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Reference images for demand';

CREATE TABLE portfolio_works (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  provider_profile_id BIGINT NOT NULL,
  provider_user_id BIGINT NOT NULL,
  related_order_id BIGINT NULL,
  photo_authorization_id BIGINT NULL,
  cover_file_id BIGINT NULL,
  title VARCHAR(100) NOT NULL,
  category VARCHAR(30) NOT NULL COMMENT 'SAMPLE/CUSTOMER_WORK',
  scene VARCHAR(40) NOT NULL,
  description TEXT NULL,
  like_count INT NOT NULL DEFAULT 0,
  view_count INT NOT NULL DEFAULT 0,
  audit_status VARCHAR(30) NOT NULL DEFAULT 'PENDING_REVIEW',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_portfolio_provider (provider_profile_id, category, scene),
  KEY idx_portfolio_user (provider_user_id, created_at),
  KEY idx_portfolio_audit (audit_status, created_at),
  CONSTRAINT fk_portfolio_profile FOREIGN KEY (provider_profile_id) REFERENCES provider_profiles(id),
  CONSTRAINT fk_portfolio_provider_user FOREIGN KEY (provider_user_id) REFERENCES users(id),
  CONSTRAINT fk_portfolio_cover_file FOREIGN KEY (cover_file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Public portfolio works; not the same as order delivery';

CREATE TABLE portfolio_work_tags (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  portfolio_work_id BIGINT NOT NULL,
  tag_id BIGINT NOT NULL,
  UNIQUE KEY uk_portfolio_tag (portfolio_work_id, tag_id),
  CONSTRAINT fk_portfolio_tag_work FOREIGN KEY (portfolio_work_id) REFERENCES portfolio_works(id),
  CONSTRAINT fk_portfolio_tag_tag FOREIGN KEY (tag_id) REFERENCES style_tags(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Portfolio style tags';

CREATE TABLE portfolio_images (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  portfolio_work_id BIGINT NOT NULL,
  file_id BIGINT NOT NULL,
  image_type VARCHAR(30) NOT NULL COMMENT 'RAW/RETOUCHED',
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_portfolio_image_file (portfolio_work_id, file_id),
  KEY idx_portfolio_image_order (portfolio_work_id, sort_order),
  CONSTRAINT fk_portfolio_image_work FOREIGN KEY (portfolio_work_id) REFERENCES portfolio_works(id),
  CONSTRAINT fk_portfolio_image_file FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Images under a portfolio work';

CREATE TABLE demand_responses (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  demand_id BIGINT NOT NULL,
  provider_user_id BIGINT NOT NULL,
  provider_profile_id BIGINT NOT NULL,
  quote_id BIGINT NULL,
  message TEXT NOT NULL,
  expected_price DECIMAL(10,2) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING_CUSTOMER_ACCEPT',
  reject_reason VARCHAR(255) NULL,
  response_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_demand_provider_response (demand_id, provider_user_id),
  KEY idx_response_provider_status (provider_user_id, status, response_time),
  KEY idx_response_demand_status (demand_id, status),
  CONSTRAINT fk_response_demand FOREIGN KEY (demand_id) REFERENCES demands(id),
  CONSTRAINT fk_response_provider_user FOREIGN KEY (provider_user_id) REFERENCES users(id),
  CONSTRAINT fk_response_provider_profile FOREIGN KEY (provider_profile_id) REFERENCES provider_profiles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Provider responses to customer demands';

CREATE TABLE demand_response_portfolios (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  response_id BIGINT NOT NULL,
  portfolio_work_id BIGINT NOT NULL,
  UNIQUE KEY uk_response_portfolio (response_id, portfolio_work_id),
  CONSTRAINT fk_response_portfolio_response FOREIGN KEY (response_id) REFERENCES demand_responses(id),
  CONSTRAINT fk_response_portfolio_work FOREIGN KEY (portfolio_work_id) REFERENCES portfolio_works(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Portfolio examples attached to a demand response';

CREATE TABLE schedules (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  provider_user_id BIGINT NOT NULL,
  schedule_date DATE NOT NULL,
  time_slot VARCHAR(80) NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  city_code VARCHAR(32) NOT NULL,
  location_hint VARCHAR(255) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
  locked_by_order_id BIGINT NULL,
  lock_expire_time DATETIME NULL,
  private_remark VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_schedule_provider_time (provider_user_id, start_time, end_time),
  KEY idx_schedule_public_search (provider_user_id, status, start_time, end_time),
  KEY idx_schedule_city_time (city_code, start_time, status),
  KEY idx_schedule_lock_expire (status, lock_expire_time),
  KEY idx_schedule_locked_order (locked_by_order_id),
  CONSTRAINT fk_schedule_provider_user FOREIGN KEY (provider_user_id) REFERENCES users(id),
  CONSTRAINT ck_schedule_time CHECK (end_time > start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Provider schedules with temporary lock support';

CREATE TABLE conversations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  participant_a_id BIGINT NOT NULL,
  participant_b_id BIGINT NOT NULL,
  source_type VARCHAR(40) NOT NULL COMMENT 'DEMAND_RESPONSE/SERVICE_PACKAGE/PORTFOLIO/DIRECT',
  source_id BIGINT NULL,
  last_message_time DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_conversation_source_pair (source_type, source_id, participant_a_id, participant_b_id),
  KEY idx_conversation_a_time (participant_a_id, last_message_time),
  KEY idx_conversation_b_time (participant_b_id, last_message_time),
  CONSTRAINT fk_conversation_a FOREIGN KEY (participant_a_id) REFERENCES users(id),
  CONSTRAINT fk_conversation_b FOREIGN KEY (participant_b_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='One-to-one conversations from demand response, service package, portfolio or direct source';

CREATE TABLE messages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  conversation_id BIGINT NOT NULL,
  sender_id BIGINT NOT NULL,
  message_type VARCHAR(30) NOT NULL COMMENT 'TEXT/IMAGE/QUOTE_CARD/SYSTEM_NOTICE',
  content TEXT NULL,
  file_id BIGINT NULL,
  reference_type VARCHAR(40) NULL COMMENT 'QUOTE/PORTFOLIO/DEMAND_RESPONSE/SERVICE_PACKAGE',
  reference_id BIGINT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_message_conversation_time (conversation_id, created_at),
  KEY idx_message_sender_time (sender_id, created_at),
  KEY idx_message_reference (reference_type, reference_id),
  CONSTRAINT fk_message_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  CONSTRAINT fk_message_sender FOREIGN KEY (sender_id) REFERENCES users(id),
  CONSTRAINT fk_message_file FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Text/image/quote card messages';

CREATE TABLE quotes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  quote_no VARCHAR(40) NOT NULL,
  conversation_id BIGINT NOT NULL,
  provider_user_id BIGINT NOT NULL,
  customer_id BIGINT NOT NULL,
  shooting_plan_id BIGINT NULL,
  source_type VARCHAR(40) NOT NULL COMMENT 'DEMAND_RESPONSE/SERVICE_PACKAGE/DIRECT',
  source_id BIGINT NULL,
  shoot_start_time DATETIME NOT NULL,
  shoot_end_time DATETIME NOT NULL,
  location VARCHAR(255) NOT NULL,
  service_content TEXT NULL,
  original_count INT NOT NULL,
  refined_count INT NOT NULL,
  delivery_deadline DATETIME NOT NULL,
  photo_usage_scope VARCHAR(60) NOT NULL DEFAULT 'PERSONAL_ONLY',
  terms TEXT NULL,
  contract_terms TEXT NULL,
  safety_notice_version VARCHAR(40) NULL,
  service_snapshot_json JSON NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING_CONFIRM',
  expire_time DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_quote_no (quote_no),
  KEY idx_quote_conversation_status (conversation_id, status, created_at),
  KEY idx_quote_provider_status (provider_user_id, status, created_at),
  KEY idx_quote_customer_status (customer_id, status, created_at),
  KEY idx_quote_source (source_type, source_id),
  CONSTRAINT fk_quote_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  CONSTRAINT fk_quote_provider_user FOREIGN KEY (provider_user_id) REFERENCES users(id),
  CONSTRAINT fk_quote_customer FOREIGN KEY (customer_id) REFERENCES users(id),
  CONSTRAINT fk_quote_plan FOREIGN KEY (shooting_plan_id) REFERENCES shooting_plans(id),
  CONSTRAINT ck_quote_time CHECK (shoot_end_time > shoot_start_time),
  CONSTRAINT ck_quote_amount CHECK (total_amount >= 0),
  CONSTRAINT ck_quote_counts CHECK (original_count >= 0 AND refined_count >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Formal quotation as pre-contract';

ALTER TABLE demand_responses
  ADD CONSTRAINT fk_response_quote FOREIGN KEY (quote_id) REFERENCES quotes(id);

CREATE TABLE orders (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_no VARCHAR(40) NOT NULL,
  quote_id BIGINT NOT NULL,
  conversation_id BIGINT NOT NULL,
  customer_id BIGINT NOT NULL,
  provider_user_id BIGINT NOT NULL,
  demand_id BIGINT NULL,
  service_package_id BIGINT NULL,
  shooting_plan_id BIGINT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'PENDING_PAYMENT' COMMENT 'PENDING_PAYMENT/PAID_PENDING_SHOOT/SHOOTING/PENDING_DELIVERY/DELIVERED_PENDING_CONFIRM/COMPLETED/CANCELLED/APPEALING/REWORK_REQUIRED/REFUNDED',
  escrow_status VARCHAR(30) NOT NULL DEFAULT 'NOT_PAID' COMMENT 'NOT_PAID/HELD/RELEASED/REFUNDED',
  settlement_status VARCHAR(30) NOT NULL DEFAULT 'NOT_SETTLED' COMMENT 'NOT_SETTLED/SETTLING/SETTLED/SETTLEMENT_FAILED',
  refund_status VARCHAR(30) NOT NULL DEFAULT 'NONE' COMMENT 'NONE/PENDING_REFUND/REFUNDED/REFUND_FAILED',
  total_amount DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  provider_income DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  shoot_start_time DATETIME NOT NULL,
  shoot_end_time DATETIME NOT NULL,
  shoot_location VARCHAR(255) NOT NULL,
  delivery_deadline DATETIME NOT NULL,
  photo_usage_scope VARCHAR(60) NOT NULL,
  quote_snapshot_json JSON NOT NULL,
  safety_notice_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  contract_terms TEXT NULL,
  auto_confirm_time DATETIME NULL,
  complete_time DATETIME NULL,
  cancel_time DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_order_no (order_no),
  UNIQUE KEY uk_order_quote (quote_id),
  KEY idx_order_customer_status_time (customer_id, status, shoot_start_time),
  KEY idx_order_provider_status_time (provider_user_id, status, shoot_start_time),
  KEY idx_order_conversation (conversation_id),
  KEY idx_order_demand (demand_id),
  KEY idx_order_service (service_package_id),
  KEY idx_order_auto_confirm (status, auto_confirm_time),
  CONSTRAINT fk_order_quote FOREIGN KEY (quote_id) REFERENCES quotes(id),
  CONSTRAINT fk_order_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  CONSTRAINT fk_order_customer FOREIGN KEY (customer_id) REFERENCES users(id),
  CONSTRAINT fk_order_provider_user FOREIGN KEY (provider_user_id) REFERENCES users(id),
  CONSTRAINT fk_order_demand FOREIGN KEY (demand_id) REFERENCES demands(id),
  CONSTRAINT fk_order_service FOREIGN KEY (service_package_id) REFERENCES service_packages(id),
  CONSTRAINT fk_order_plan FOREIGN KEY (shooting_plan_id) REFERENCES shooting_plans(id),
  CONSTRAINT ck_order_time CHECK (shoot_end_time > shoot_start_time),
  CONSTRAINT ck_order_amount CHECK (total_amount >= 0 AND platform_fee >= 0 AND provider_income >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Orders created from confirmed quotes';

ALTER TABLE schedules
  ADD CONSTRAINT fk_schedule_locked_order FOREIGN KEY (locked_by_order_id) REFERENCES orders(id);

ALTER TABLE portfolio_works
  ADD CONSTRAINT fk_portfolio_related_order FOREIGN KEY (related_order_id) REFERENCES orders(id);

CREATE TABLE order_status_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  from_status VARCHAR(40) NULL,
  to_status VARCHAR(40) NOT NULL,
  operator_id BIGINT NULL,
  operator_role VARCHAR(20) NULL,
  remark TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_order_status_log_order_time (order_id, created_at),
  CONSTRAINT fk_order_status_log_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_order_status_log_operator FOREIGN KEY (operator_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Order timeline and evidence';

CREATE TABLE payment_records (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  payment_no VARCHAR(40) NOT NULL,
  third_party_trade_no VARCHAR(80) NULL,
  amount DECIMAL(10,2) NOT NULL,
  refund_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  pay_method VARCHAR(30) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME NULL,
  refunded_at DATETIME NULL,
  UNIQUE KEY uk_payment_no (payment_no),
  KEY idx_payment_order_status (order_id, status, requested_at),
  KEY idx_payment_third_trade (third_party_trade_no),
  CONSTRAINT fk_payment_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT ck_payment_amount CHECK (amount >= 0 AND refund_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Payment and refund records';

CREATE TABLE deliveries (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  delivery_round INT NOT NULL DEFAULT 1,
  is_latest BOOLEAN NOT NULL DEFAULT TRUE,
  original_count INT NOT NULL DEFAULT 0,
  refined_count INT NOT NULL DEFAULT 0,
  deadline DATETIME NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'UPLOADED',
  remark TEXT NULL,
  upload_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirm_time DATETIME NULL,
  auto_confirm_deadline DATETIME NULL,
  UNIQUE KEY uk_delivery_order_round (order_id, delivery_round),
  KEY idx_delivery_order_latest (order_id, is_latest),
  KEY idx_delivery_deadline_status (deadline, status),
  CONSTRAINT fk_delivery_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT ck_delivery_counts CHECK (original_count >= 0 AND refined_count >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Private delivery rounds for an order';

CREATE TABLE delivery_files (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  delivery_id BIGINT NOT NULL,
  file_id BIGINT NOT NULL,
  file_type VARCHAR(30) NOT NULL COMMENT 'RAW/RETOUCHED',
  sort_order INT NOT NULL DEFAULT 0,
  upload_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_delivery_file (delivery_id, file_id),
  KEY idx_delivery_file_type (delivery_id, file_type, sort_order),
  CONSTRAINT fk_delivery_file_delivery FOREIGN KEY (delivery_id) REFERENCES deliveries(id),
  CONSTRAINT fk_delivery_file_file FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Files in delivery rounds';

CREATE TABLE photo_authorizations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  customer_id BIGINT NOT NULL,
  provider_user_id BIGINT NOT NULL,
  photo_usage_scope VARCHAR(60) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'GRANTED',
  remark TEXT NULL,
  authorized_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expire_time DATETIME NULL,
  KEY idx_photo_auth_order (order_id, authorized_at),
  KEY idx_photo_auth_provider (provider_user_id, authorized_at),
  CONSTRAINT fk_photo_auth_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_photo_auth_customer FOREIGN KEY (customer_id) REFERENCES users(id),
  CONSTRAINT fk_photo_auth_provider FOREIGN KEY (provider_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Portrait and photo usage authorization';

CREATE TABLE photo_authorization_files (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  authorization_id BIGINT NOT NULL,
  file_id BIGINT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_photo_auth_file (authorization_id, file_id),
  CONSTRAINT fk_photo_auth_file_auth FOREIGN KEY (authorization_id) REFERENCES photo_authorizations(id),
  CONSTRAINT fk_photo_auth_file_file FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Files covered by a photo authorization';

ALTER TABLE portfolio_works
  ADD CONSTRAINT fk_portfolio_photo_auth FOREIGN KEY (photo_authorization_id) REFERENCES photo_authorizations(id);

CREATE TABLE reviews (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  reviewer_id BIGINT NOT NULL,
  target_user_id BIGINT NOT NULL,
  direction VARCHAR(40) NOT NULL,
  rating INT NOT NULL,
  content TEXT NULL,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  reply_content TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reply_time DATETIME NULL,
  UNIQUE KEY uk_review_once (order_id, direction),
  KEY idx_review_target_time (target_user_id, created_at),
  KEY idx_review_reviewer_time (reviewer_id, created_at),
  CONSTRAINT fk_review_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_review_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id),
  CONSTRAINT fk_review_target FOREIGN KEY (target_user_id) REFERENCES users(id),
  CONSTRAINT ck_review_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Two-way reviews';

CREATE TABLE review_images (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  review_id BIGINT NOT NULL,
  file_id BIGINT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_review_image (review_id, file_id),
  CONSTRAINT fk_review_image_review FOREIGN KEY (review_id) REFERENCES reviews(id),
  CONSTRAINT fk_review_image_file FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Review images';

CREATE TABLE review_reports (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  review_id BIGINT NOT NULL,
  reporter_id BIGINT NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  admin_id BIGINT NULL,
  admin_remark TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL,
  KEY idx_review_report_status (status, created_at),
  KEY idx_review_report_review (review_id),
  CONSTRAINT fk_review_report_review FOREIGN KEY (review_id) REFERENCES reviews(id),
  CONSTRAINT fk_review_report_reporter FOREIGN KEY (reporter_id) REFERENCES users(id),
  CONSTRAINT fk_review_report_admin FOREIGN KEY (admin_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Malicious review reports';

CREATE TABLE review_report_files (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  report_id BIGINT NOT NULL,
  file_id BIGINT NOT NULL,
  UNIQUE KEY uk_review_report_file (report_id, file_id),
  CONSTRAINT fk_review_report_file_report FOREIGN KEY (report_id) REFERENCES review_reports(id),
  CONSTRAINT fk_review_report_file_file FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Evidence for review reports';

CREATE TABLE credit_records (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  related_order_id BIGINT NULL,
  event_type VARCHAR(40) NOT NULL,
  score_change INT NOT NULL,
  score_after DECIMAL(5,2) NOT NULL,
  reason TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_credit_user_time (user_id, created_at),
  KEY idx_credit_order (related_order_id),
  CONSTRAINT fk_credit_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_credit_order FOREIGN KEY (related_order_id) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Credit score changes';

CREATE TABLE disputes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  applicant_id BIGINT NOT NULL,
  respondent_id BIGINT NOT NULL,
  admin_id BIGINT NULL,
  type VARCHAR(40) NOT NULL,
  description TEXT NOT NULL,
  respondent_reply TEXT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'PENDING_RESPONSE',
  result VARCHAR(40) NULL,
  refund_amount DECIMAL(10,2) NULL,
  admin_remark TEXT NULL,
  respond_deadline DATETIME NULL,
  create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolve_time DATETIME NULL,
  KEY idx_dispute_order (order_id),
  KEY idx_dispute_status_time (status, create_time),
  KEY idx_dispute_admin (admin_id, status),
  KEY idx_dispute_applicant (applicant_id, create_time),
  CONSTRAINT fk_dispute_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_dispute_applicant FOREIGN KEY (applicant_id) REFERENCES users(id),
  CONSTRAINT fk_dispute_respondent FOREIGN KEY (respondent_id) REFERENCES users(id),
  CONSTRAINT fk_dispute_admin FOREIGN KEY (admin_id) REFERENCES users(id),
  CONSTRAINT ck_dispute_refund CHECK (refund_amount IS NULL OR refund_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Order disputes and arbitration';

CREATE TABLE dispute_evidence_files (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  dispute_id BIGINT NOT NULL,
  file_id BIGINT NOT NULL,
  uploader_id BIGINT NOT NULL,
  evidence_role VARCHAR(30) NOT NULL COMMENT 'APPLICANT/RESPONDENT/ADMIN',
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_dispute_evidence_file (dispute_id, file_id),
  CONSTRAINT fk_dispute_evidence_dispute FOREIGN KEY (dispute_id) REFERENCES disputes(id),
  CONSTRAINT fk_dispute_evidence_file FOREIGN KEY (file_id) REFERENCES files(id),
  CONSTRAINT fk_dispute_evidence_uploader FOREIGN KEY (uploader_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Dispute evidence files';

CREATE TABLE dispute_replies (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  dispute_id BIGINT NOT NULL,
  replier_id BIGINT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_dispute_reply_time (dispute_id, created_at),
  CONSTRAINT fk_dispute_reply_dispute FOREIGN KEY (dispute_id) REFERENCES disputes(id),
  CONSTRAINT fk_dispute_reply_user FOREIGN KEY (replier_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Replies in a dispute';

CREATE TABLE dispute_reply_files (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  reply_id BIGINT NOT NULL,
  file_id BIGINT NOT NULL,
  UNIQUE KEY uk_dispute_reply_file (reply_id, file_id),
  CONSTRAINT fk_dispute_reply_file_reply FOREIGN KEY (reply_id) REFERENCES dispute_replies(id),
  CONSTRAINT fk_dispute_reply_file_file FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Files attached to dispute replies';

CREATE TABLE audit_records (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  audit_type VARCHAR(40) NOT NULL,
  target_id BIGINT NOT NULL,
  admin_id BIGINT NOT NULL,
  audit_result VARCHAR(30) NOT NULL,
  remark TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_target (audit_type, target_id),
  KEY idx_audit_admin_time (admin_id, created_at),
  CONSTRAINT fk_audit_admin FOREIGN KEY (admin_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Admin audit records for certifications, service packages, works, reviews and disputes';

CREATE TABLE notifications (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  title VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  type VARCHAR(40) NOT NULL,
  related_type VARCHAR(40) NULL,
  related_id BIGINT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notification_user_read_time (user_id, is_read, created_at),
  KEY idx_notification_related (related_type, related_id),
  CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='In-app notifications';

CREATE TABLE idempotency_records (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  request_method VARCHAR(10) NOT NULL,
  request_path VARCHAR(255) NOT NULL,
  resource_type VARCHAR(40) NULL,
  resource_id BIGINT NULL,
  response_digest CHAR(64) NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_idempotency_user_key (user_id, idempotency_key),
  KEY idx_idempotency_expire (expires_at),
  CONSTRAINT fk_idempotency_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Idempotency records for payment, quote confirmation, review and dispute creation';

SET FOREIGN_KEY_CHECKS = 1;
```
