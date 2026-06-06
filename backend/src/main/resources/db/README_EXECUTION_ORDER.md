# SQL 执行顺序说明

## 执行环境要求

- **MySQL 8.0+**（依赖 `utf8mb4_unicode_ci` / `utf8mb4_0900_ai_ci` 排序规则和存储过程语法）
- **执行工具**：必须使用 `mysql` CLI 或 MySQL Workbench，**不可使用**普通 JDBC 单语句执行器  
  （`b1_b2_persistence.sql` 等文件包含 `DELIMITER //` 存储过程定义，单语句执行器无法处理）

---

## 全新库执行顺序

| 步骤 | 文件 | 覆盖的表 |
|------|------|---------|
| 1 | `V1_baseline.sql` | users、files、user_role_bindings、credit_records、quotes、orders、order_status_logs、payment_records、disputes、dispute_replies、deliveries、delivery_files、photo_authorizations、photo_authorization_files、student_certifications |
| 2 | `certification.sql` | real_name_certifications、audit_records、provider_profiles |
| 3 | `b1_b2_persistence.sql` | service_packages、demands、service_package_interests、demand_responses |
| 4 | `conversations_messages.sql` | conversations、messages、conversation_hidden_by_user（依赖 users、files） |
| 5 | `d_line_backend.sql` | reviews、review_complaints、notifications |
| 6 | `moments.sql` | 动态模块 |
| 7 | `migration/add_dual_identity_fields.sql` | provider_profiles 双身份字段、user_follows 三列唯一索引 |
| 8 | `migration/alter_moment_images_image_data.sql` | moment_images 图片数据字段变更 |

**以下表目前不在本目录任何脚本中定义，需团队另行补充（在步骤 1 之前或之后）：**
- `schedules`：被其他模块引用，但当前代码库无对应 Java entity
- `user_follows`：被步骤 7 引用，需在步骤 7 之前存在

---

## 特殊文件说明

### certification_compat.sql
**仅用于从 P3 老结构迁移，全新库勿执行。**  
将旧版 `real_name_certifications`、`provider_profiles`、`audit_records` 表结构对齐到当前版本。  
所有 DDL 已改写为 information_schema 幂等写法，可安全重复执行。执行前务必备份。

### local_patch_*.sql
**仅用于本地补迁移历史遗留库，全新库勿执行。**
- `local_patch_camera_app_missing_schema.sql`：补充 `credit_records`、`notifications`、`reviews`、`review_complaints` 缺失列和索引
- `local_patch_camera_app_certification_disputes_sync.sql`：认证与纠纷相关历史补丁，含 UPDATE 回填，执行前务必备份

---

## 旧库迁移补丁

**`disputes.refund_amount` 类型迁移**  
- `V1_baseline.sql` 已将新库定义为 `BIGINT`（分），与 Java `Dispute.refundAmount: Long` 对齐  
- 已有旧库（P3 建表）中此列可能为 `DECIMAL(10,2)`（元），需执行：  
  `migration/fix_disputes_refund_amount_type.sql`  
  该脚本幂等，重复执行安全；执行前务必备份数据库
