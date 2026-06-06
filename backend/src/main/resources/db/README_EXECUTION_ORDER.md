# SQL 执行顺序说明

## 执行环境要求

- **MySQL 8.0+**（依赖 `utf8mb4_unicode_ci` / `utf8mb4_0900_ai_ci` 排序规则和存储过程语法）
- **执行工具**：必须使用 `mysql` CLI 或 MySQL Workbench，**不可使用**普通 JDBC 单语句执行器  
  （`b1_b2_persistence.sql` 等文件包含 `DELIMITER //` 存储过程定义，单语句执行器无法处理）

---

## 路径 A：全新库初始化（从零建库）

> 只执行以下步骤，不执行路径 B 的任何脚本。

| 步骤 | 文件 | 说明 |
|------|------|------|
| 1 | `V1_baseline.sql` | users、files、user_role_bindings、credit_records、quotes、orders、order_status_logs、payment_records、disputes、dispute_replies、deliveries、delivery_files、photo_authorizations、photo_authorization_files、student_certifications |
| 2 | `certification.sql` | real_name_certifications、audit_records、provider_profiles |
| 3 | `b1_b2_persistence.sql` | service_packages、demands、service_package_interests、demand_responses |
| 4 | `conversations_messages.sql` | conversations、messages、conversation_hidden_by_user（依赖 users、files） |
| 5 | `d_line_backend.sql` | reviews、review_complaints、notifications |
| 6 | `moments.sql` | 动态模块 |
| 7 | `migration/add_dual_identity_fields.sql` | provider_profiles 双身份字段、user_follows 三列唯一索引 |
| 8 | `migration/alter_moment_images_image_data.sql` | moment_images 图片数据字段变更 |

> 注：以下表当前无对应脚本，需团队另行补充后再初始化：`schedules`

---

## 路径 B：旧库迁移（从 P3 历史库升级）

> **执行前必须备份数据库。**  
> 不要在全新库上执行路径 B 的任何脚本。

按以下顺序执行：

| 步骤 | 文件 | 说明 |
|------|------|------|
| 1 | `migration/fix_disputes_refund_amount_type.sql` | 将 disputes.refund_amount 从 DECIMAL 改 BIGINT；脚本会自动检测小数值并回填，但整数值须人工确认单位（详见脚本注释） |
| 2 | `certification_compat.sql` | 将旧版认证/审核表字段对齐到当前模型，PENDING_REVIEW → PENDING |
| 3 | `local_patch_camera_app_missing_schema.sql` | 补充 credit_records / notifications / reviews / review_complaints 缺失列和索引 |
| 4 | `local_patch_camera_app_certification_disputes_sync.sql` | 认证与纠纷字段同步，含 UPDATE 回填 |
| 5 | `migration/add_dual_identity_fields.sql` | provider_profiles 双身份字段、user_follows 三列唯一索引 |
| 6 | `migration/alter_moment_images_image_data.sql` | moment_images 图片字段扩展 |

---

## 文件属性速查

| 文件 | 属性 | 适用路径 |
|------|------|---------|
| V1_baseline.sql | 全量建表，幂等 | 路径 A |
| certification.sql | 认证/审核/档案建表，幂等 | 路径 A |
| b1_b2_persistence.sql | 供需模块建表+迁移，含存储过程 | 路径 A |
| conversations_messages.sql | 会话消息建表+迁移，含存储过程 | 路径 A |
| d_line_backend.sql | 评价/通知模块建表+迁移，含存储过程 | 路径 A |
| moments.sql | 动态模块建表，幂等 | 路径 A |
| certification_compat.sql | P3 历史兼容迁移，一次性 | 路径 B |
| local_patch_*.sql | 本地历史补丁，一次性 | 路径 B |
| migration/add_dual_identity_fields.sql | 双身份字段迁移，幂等 | 路径 A & B |
| migration/alter_moment_images_image_data.sql | 图片字段扩展，幂等 | 路径 A & B |
| migration/fix_disputes_refund_amount_type.sql | 旧数据类型迁移，幂等 | 路径 B |
