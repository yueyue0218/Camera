# SQL 执行顺序说明

## 执行环境要求

- **MySQL 8.0+**（依赖 `utf8mb4_unicode_ci` / `utf8mb4_0900_ai_ci` 排序规则和存储过程语法）
- **执行工具**：必须使用 `mysql` CLI 或 MySQL Workbench，**不可使用**普通 JDBC 单语句执行器  
  （路径 A 的 `conversations_messages.sql` 及路径 B 的 `b1_b2_persistence.sql`、`d_line_backend.sql` 均包含 `DELIMITER //` 存储过程定义，单语句执行器无法处理）

---

## 路径 A：全新库初始化（从零建库）

> 只执行以下步骤，不执行路径 B 的任何脚本。

| 步骤 | 文件 | 说明 |
|------|------|------|
| 1 | `V1_baseline.sql` | users、files、user_role_bindings、credit_records、quotes、orders、order_status_logs、payment_records、disputes、dispute_replies、deliveries、delivery_files、photo_authorizations、photo_authorization_files、student_certifications |
| 2 | `certification.sql` | real_name_certifications、audit_records、provider_profiles |
| 3 | `V3_b1_b2_fresh.sql` | service_packages、demands、service_package_interests、demand_responses（纯建表，无存储过程） |
| 4 | `conversations_messages.sql` | conversations、messages、conversation_hidden_by_user（依赖 users、files） |
| 5 | `V5_d_line_fresh.sql` | reviews、review_complaints、notifications（纯建表，无存储过程） |
| 6 | `moments.sql` | 动态模块 |
| 7 | `migration/add_admin_governance.sql` | demands、service_packages、moment_posts 独立治理字段与 reports 表；MySQL 8 兼容、可重复执行 |
| 8 | `migration/add_phone_auth_sessions.sql` | users 手机号字段、sms_challenges、user_sessions 及认证索引；这是认证模块的 canonical fresh-init SQL |
| 9 | `migration/add_dual_identity_fields.sql` | provider_profiles 双身份字段、user_follows 三列唯一索引 |
| 10 | `migration/alter_moment_images_image_data.sql` | moment_images 图片数据字段变更 |
| 11 | `migration/add_user_profile_visibility.sql` | users 资料展示字段（当前 baseline 尚未包含）；MySQL 8 兼容、可重复执行，字段已存在时只输出提示 |

> 注：`schedules` 表当前无对应初始化脚本。代码未直接访问 schedules 表，不阻断 Railway fresh 初始化；档期模块恢复时再补充 V2_schedule.sql。

> ⛔ **以下文件严禁在路径 A（Railway 新库）执行：**  
> `b1_b2_persistence.sql`、`d_line_backend.sql`、`certification_compat.sql`、  
> `local_patch_*.sql`、`migration/fix_disputes_refund_amount_type.sql`  
> —— 以上均为旧库迁移脚本，在全新库执行会导致存储过程报错或数据错误回填。

---

## 路径 B：旧库迁移（从 P3 历史库升级）

> **执行前必须备份数据库。**  
> 不要在全新库上执行路径 B 的任何脚本。

按以下顺序执行：

| 步骤 | 文件 | 说明 |
|------|------|------|
| 1 | `migration/fix_disputes_refund_amount_type.sql` | 将 disputes.refund_amount 从 DECIMAL 改 BIGINT；脚本会自动检测小数值并回填，但整数值须人工确认单位（详见脚本注释） |
| 2 | `b1_b2_persistence.sql` | service_packages、demands、demand_responses 字段补齐与数据回填（含存储过程，需 mysql CLI 执行） |
| 3 | `d_line_backend.sql` | reviews、review_complaints、notifications、credit_records 字段补齐与数据回填（含存储过程，需 mysql CLI 执行） |
| 4 | `certification_compat.sql` | 将旧版认证/审核表字段对齐到当前模型，PENDING_REVIEW → PENDING |
| 5 | `local_patch_camera_app_missing_schema.sql` | 补充 credit_records / notifications / reviews / review_complaints 缺失列和索引 |
| 6 | `local_patch_camera_app_certification_disputes_sync.sql` | 认证与纠纷字段同步，含 UPDATE 回填 |
| 7 | `migration/add_dual_identity_fields.sql` | provider_profiles 双身份字段、user_follows 三列唯一索引 |
| 8 | `migration/alter_moment_images_image_data.sql` | moment_images 图片字段扩展 |
| 9 | `migration/add_user_profile_visibility.sql` | users 资料展示字段；部署新代码前执行；MySQL 8 兼容、可重复执行，字段已存在时只输出提示 |
| 10 | `migration/add_payment_order_unique_constraint.sql` | 先检查重复 order_id，再增加支付记录唯一约束；禁止静默删除重复资金记录 |
| 11 | `migration/add_dispute_previous_order_status.sql` | 第一阶段新增 nullable 列并按状态日志回填；部署窗口内暂不强制 NOT NULL |
| 12 | `migration/add_admin_governance.sql` | 新增独立内容治理字段、索引和 reports 表；执行后完成下方治理数据闸门 |
| 13 | `migration/add_phone_auth_sessions.sql` | 新增 users 手机号字段、认证挑战表、可撤销会话表和全部认证索引；部署认证代码前执行 |

---

## 自动部署前数据库闸门

push 到 `main` 会在 CI 成功后自动替换后端 JAR 并重启服务，部署流程不会执行数据库迁移。旧库发布必须在 push 前进入维护窗口并完成：

1. 备份数据库。
2. 执行 `add_admin_governance.sql`；脚本按字段和索引逐项检查 `information_schema`，可安全重复执行。
3. 在首次部署治理代码前，分别执行 `SELECT COUNT(*) FROM demands WHERE moderation_status <> 'VISIBLE';`、`SELECT COUNT(*) FROM service_packages WHERE moderation_status <> 'VISIBLE';`、`SELECT COUNT(*) FROM moment_posts WHERE moderation_status <> 'VISIBLE';`，三个结果都必须为 0，确认历史公开内容没有被迁移误隐藏。
4. 执行 `SELECT active_dedupe_key, COUNT(*) FROM reports WHERE active_dedupe_key IS NOT NULL GROUP BY active_dedupe_key HAVING COUNT(*) > 1;`，必须无结果；如有结果，停止部署并人工核对举报记录。
5. 执行 `add_phone_auth_sessions.sql`；确认 `duplicate_phone_count = 0`，并核对脚本输出包含 users、sms_challenges、user_sessions 的全部认证索引。该脚本必须先于任何依赖新 Entity/Repository 的 JAR 部署。
6. 执行 `add_user_profile_visibility.sql`。该脚本会先检查 `information_schema.COLUMNS`，字段已存在时只输出提示，不重复添加。
7. 执行 `SELECT order_id, COUNT(*) FROM payment_records GROUP BY order_id HAVING COUNT(*) > 1;`。如有结果，先依据权威支付记录人工处理，不得删除后直接继续。
8. 确认无重复后执行 `add_payment_order_unique_constraint.sql`。
9. 执行 `add_dispute_previous_order_status.sql`，检查脚本最后返回的 unresolved dispute；无法回填的历史记录保留 nullable，由新代码安全拒绝恢复。
10. 检查所有迁移均成功且没有半迁移状态，再 push `main` 部署代码。
11. 部署后验证重复支付、争议驳回恢复、公开作品和交付文件权限，以及手机号登录、Session 刷新和撤销流程。

`previous_order_status` 的 `NOT NULL` 收紧属于第二阶段维护操作。只有在新代码已稳定运行、确认所有历史与新增 dispute 均无 null 后才可执行，不得与本次自动部署绑定。

---

## 文件属性速查

| 文件 | 属性 | 适用路径 |
|------|------|---------|
| V1_baseline.sql | 全量建表，幂等 | 路径 A |
| certification.sql | 认证/审核/档案建表，幂等 | 路径 A |
| V3_b1_b2_fresh.sql | 供需模块纯建表，幂等，无存储过程 | 路径 A |
| conversations_messages.sql | 会话消息建表+迁移，含存储过程 | 路径 A |
| V5_d_line_fresh.sql | 评价/通知模块纯建表，幂等，无存储过程 | 路径 A |
| moments.sql | 动态模块建表，幂等 | 路径 A |
| b1_b2_persistence.sql | 供需模块字段回填迁移，含存储过程，一次性 | 路径 B |
| d_line_backend.sql | 评价/通知模块字段回填迁移，含存储过程，一次性 | 路径 B |
| certification_compat.sql | P3 历史兼容迁移，一次性 | 路径 B |
| local_patch_*.sql | 本地历史补丁，一次性 | 路径 B |
| migration/add_dual_identity_fields.sql | 双身份字段迁移，幂等 | 路径 A & B |
| migration/alter_moment_images_image_data.sql | 图片字段扩展，幂等 | 路径 A & B |
| migration/fix_disputes_refund_amount_type.sql | 旧数据类型迁移，幂等 | 路径 B |
| migration/add_user_profile_visibility.sql | users 资料展示字段，MySQL 8 兼容且幂等 | 路径 A & B |
| migration/add_admin_governance.sql | 内容治理字段、索引与 reports 表，MySQL 8 兼容且幂等 | 路径 A & B |
| migration/add_phone_auth_sessions.sql | 手机号、短信挑战、可撤销会话及认证索引，MySQL 8 兼容且幂等 | 路径 A & B |
| migration/add_payment_order_unique_constraint.sql | 支付记录按订单唯一，一次性，执行前必须检查重复数据 | 路径 B |
| migration/add_dispute_previous_order_status.sql | 争议前状态第一阶段 nullable 迁移，一次性 | 路径 B |
