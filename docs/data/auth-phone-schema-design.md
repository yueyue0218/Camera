# A5 AUTH 手机号账号数据库设计

## 1. Scope

本阶段仅交付手机号账号的数据库存储契约、幂等 migration、索引与唯一约束草案、兼容迁移、回滚说明和本地 MySQL 验证。不实现手机号登录、验证码、SMS Provider、Redis、JWT、Session、Logout、CUSTOMER 授予或重新认证业务。

工作基线：

- Base：`origin/main`
- Base commit：`30ac97323b35d1e456cb28987a634e1898c70717`
- Worktree：`C:\Users\LiXiaozhou\Camera-A-AuthSchema`
- Branch：`data/auth-phone-schema`

## 2. B frozen inputs

仓库内当前只能确认以下项目级设计意图，尚未发现 B 线对完整手机号账号规则的正式冻结记录：

- P1 要求支持手机号加验证码注册登录。
- P1 确认同一账号支持 CUSTOMER / PROVIDER 多角色。
- P3 使用 `mobile_cipher`、`mobile_hash`、`mobile_masked`，禁止明文手机号，使用 hash 做查询与唯一性设计。
- P3 的 `POST /sessions` 请求包含手机号、验证码和可选初始角色，但当前真实 `/sessions` demo 入口已移除。
- 管理员治理已经冻结：`users.status = DISABLED` 时，旧 JWT 下一次访问受保护接口立即失效。

这些内容不足以代替 B 线对手机号绑定、验证和会话语义的正式确认。

## 3. Missing B inputs

以下项目均标记为 `MISSING B INPUT`：

| 缺失规则 | 数据库或发布影响 |
|---|---|
| 一个手机号是否只能对应一个账号 | 决定 `uk_users_mobile_hash` 是否可以进入 Staging/Production |
| 旧账号首次绑定流程 | 决定何时写入 cipher/hash/masked，以及失败时的原子性 |
| verified 完成时点 | 决定 `phone_verified_at` 的写入事务边界 |
| 新账号何时获得 CUSTOMER | 影响 `user_role_bindings` 与 `current_role`，A5 不做回填 |
| 重新认证条件 | 可能影响后续 reauth 状态或时间字段，本阶段不新增 |
| 手机号变化时 Session/JWT 如何失效 | 可能影响后续会话模型，本阶段不新增字段 |
| Logout 语义 | 当前文档仅有接口，无 refresh token 撤销规则 |
| 手机号规范化规则 | 决定 hash 输入；`+86`、空格、横杠、国家码均未冻结 |
| SHA-256 或 HMAC-SHA256 | `CHAR(64)` 均兼容，但密钥与轮换策略必须由 B/C 决定 |

发布 Gate：

```text
UNIQUE(mobile_hash):
proposed and locally validated;
staging/production rollout requires B confirmation
of one-phone-one-account semantics.
```

## 4. Existing schema

### 4.1 `origin/main` 的 `V1_baseline.sql`

| column | SQL type | nullable | default | index / unique | FK impact |
|---|---|---:|---|---|---|
| id | BIGINT AUTO_INCREMENT | NO | - | PRIMARY KEY | 被业务表引用，不修改 |
| student_no | VARCHAR(9) | YES | NULL | UNIQUE | 原登录标识，不修改 |
| password_hash | VARCHAR(100) | YES | NULL | - | 原登录凭据，不修改 |
| nickname | VARCHAR(64) | NO | - | - | 不修改 |
| school | VARCHAR(128) | YES | NULL | - | 不修改 |
| avatar_file_id | BIGINT | YES | NULL | - | 不修改 |
| gender | VARCHAR(20) | YES | NULL | - | 不修改 |
| city_code | VARCHAR(32) | YES | NULL | - | 不修改 |
| bio | VARCHAR(500) | YES | NULL | - | 不修改 |
| current_role | VARCHAR(20) | NO | CUSTOMER | - | 角色行为不修改 |
| status | VARCHAR(20) | NO | ACTIVE | `idx_users_status` | 账号限制语义不修改 |
| credit_score | DECIMAL(5,2) | YES | NULL | - | 不修改 |
| created_at | DATETIME | NO | CURRENT_TIMESTAMP | - | 不修改 |
| updated_at | DATETIME | NO | CURRENT_TIMESTAMP/ON UPDATE | - | 不修改 |

`migration/add_user_profile_visibility.sql` 另行补充 `gender_visible`、`birthday`、`birthday_visible`、`location_display`、`location_visible`；`User` entity 已映射这些字段，但它们不属于 A5。只读审计的本机历史 `camera_app` 尚未应用这些展示字段，A5 不越界修正该差异。


`User` entity 和 `UserRepository` 当前没有手机号字段或手机号查询方法。本阶段不修改它们。

### 4.2 本地历史 P3 `camera_app.users` 只读审计

MySQL 8.0.41 的历史表已经包含：

- `mobile_cipher VARBINARY(512) NULL`
- `mobile_hash CHAR(64) NULL`
- `mobile_masked VARCHAR(32) NULL`
- `UNIQUE KEY uk_users_mobile_hash (mobile_hash)`

但不包含 `phone_verified_at`。当前 5 个本地用户的三个 `mobile_*` 字段全部为 `NULL`，未复制其业务数据到测试库。

历史 schema 有 52 张表、37 个指向 `users.id` 的外键。`add_dual_identity_fields.sql` 仅修改 provider avatar 和 follow role，不修改 `users`，与 A5 不冲突。

## 5. Proposed schema

| column | type | nullable | default | purpose |
|---|---|---:|---|---|
| mobile_cipher | VARBINARY(512) | YES | NULL | 加密后的规范化手机号；禁止明文存储 |
| mobile_hash | CHAR(64) | YES | NULL | 规范化手机号的查询和候选唯一键 |
| mobile_masked | VARCHAR(32) | YES | NULL | 普通资料接口可用的脱敏展示值 |
| phone_verified_at | DATETIME(6) | YES | NULL | 手机号真正完成验证的时间 |

不增加 `phone` 明文列，不修改 `users.id`，不重建 `users`，不增加 Session、reauth、tokenVersion 或新的账号状态列。

## 6. Field definitions

`mobile_cipher` 保存密文而不是规范化明文。数据库列不建立查询索引。

`mobile_hash` 允许 `NULL`，使历史用户可以继续使用原有登录方式。非空值必须是 B 线规范化输入产生的 64 字符十六进制 hash；数据库本阶段不生成该值。

`mobile_masked` 只用于展示，不作为登录或唯一性依据。

`phone_verified_at IS NULL` 表示没有已确认的真实验证完成时间；非空只能表示验证码等真实验证流程已经完成。具体写入时点由 B 冻结。

## 7. Normalized phone / mobile_hash contract

数据库先冻结以下最小契约：

- 输入必须来自同一个、由 B 冻结的手机号规范化函数。
- 输出存入 `CHAR(64)`，兼容 SHA-256 与 HMAC-SHA256 的十六进制表示。
- 查找和唯一判断只依赖 `mobile_hash`，不依赖密文或脱敏值。
- A5 不决定 `+86`、本地号码、空格、横杠、国家码、HMAC key 或 key rotation。
- 在 B 完成上述规则前，所有旧用户 `mobile_hash` 保持 `NULL`。

使用 hash 而不是手机号明文作为唯一查询键，可避免直接索引敏感明文，同时保留稳定的等值查询能力。密文用于必要时恢复完整号码，脱敏值用于展示，三者职责分离。

## 8. Unique constraint and indexes

| name | column | type | query purpose | rollout |
|---|---|---|---|---|
| uk_users_mobile_hash | mobile_hash | UNIQUE | 登录查找候选唯一账号、防止重复绑定 | 本地已验证；生产受 B Gate 阻塞 |
| 无新增索引 | mobile_cipher | - | 密文不参与查询 | 不创建 |
| 无新增索引 | mobile_masked | - | 展示字段不参与身份查找 | 不创建 |
| 无新增索引 | phone_verified_at | - | 当前没有按验证时间查询的冻结需求 | 不创建 |

MySQL 8 唯一索引允许多个 `NULL`。本地验证中三个 `NULL mobile_hash` 用户可同时存在；两个相同的非空 hash 会得到错误 1062。

## 9. LEGACY_UNBOUND design

第一阶段不新增 enum 或状态字段。`LEGACY_UNBOUND` 只是 migration compatibility state，派生条件为：

```sql
mobile_cipher IS NULL
AND mobile_hash IS NULL
AND mobile_masked IS NULL
AND phone_verified_at IS NULL
```

它不是 B 已冻结的业务枚举。`mobile_hash IS NOT NULL` 且其他字段任一为空时，不归类为 `LEGACY_UNBOUND`，而归入 `partial/inconsistent legacy state` 并在验证中单独计数。

## 10. Backfill

| 类别 | Before | Migration | After |
|---|---|---|---|
| A. 无任何手机号信息 | 没有字段，或三个 mobile 字段全 NULL | 只补 nullable 列和索引，不 UPDATE | 四字段全 NULL，派生为 LEGACY_UNBOUND |
| B. 已有 legacy phone 字段 | 当前仓库无其他权威手机号来源 | 不适用，不从昵称/学号等推断 | 不生成假手机号 |
| C. 有手机号但未验证 | 当前仓库无权威数据来源 | 不适用；如未来发现，必须由 B 给出转换规则 | 不伪造 verified 时间 |
| D. 已验证手机号 | 当前仓库无 `phone_verified_at` 权威来源 | 不适用；不以 mobile_hash 非空推断已验证 | verified 时间保持 NULL，等待权威事件 |

## 11. Migration sequence

文件：`backend/src/main/resources/db/migration/add_auth_phone_account.sql`

执行顺序：

1. 校验当前数据库存在 `users`。
2. 用 `information_schema.columns` 条件补齐四个 nullable 字段。
3. 在 unique DDL 前执行非空 `mobile_hash` 重复分组检查。
4. 存在重复时以 SQLSTATE 45000 和 `DUPLICATE MOBILE HASH DETECTED` 停止。
5. 不存在重复时，新增或验证 `uk_users_mobile_hash`。
6. 删除临时 migration procedure。
7. 输出字段、索引、LEGACY_UNBOUND 和 partial/inconsistent 计数。

脚本不含 `UPDATE users`、不删除用户、不修改 `users.id`。重复执行不会重复创建字段或索引。

## 12. README execution order

`README_EXECUTION_ORDER.md` 已登记：

- Fresh 路径 A：在现有步骤之后执行，补齐 baseline 缺失字段。
- Legacy 路径 B：在既有 P3/治理迁移后执行，保留已有 mobile 字段和索引，只补缺失项。
- 单独增加 A5 AUTH 发布 Gate；B 未确认时不得在 Staging/Production 执行。

## 13. Local migration verification

环境：MySQL 8.0.41，账号 `camera_dev@localhost`。未修改 `camera_app` 或 `camera_perf_a1`。
验证实际执行了 `SELECT VERSION()`、`SHOW CREATE TABLE users`、`SHOW INDEX FROM users`、`information_schema.columns`、`information_schema.statistics`、users.id 外键计数和 `CHECK TABLE`。

### 13.1 Baseline path

- DB：`camera_auth_migration_test_baseline`
- 来源：仓库正式 `V1_baseline.sql`
- Before：15 tables；3 users（810001、810002、810003）；2 role bindings；无 mobile/verified 字段；无 mobile hash 索引。
- After：四字段类型和 nullable 均符合设计；`uk_users_mobile_hash` 为单列 UNIQUE。
- 三个用户全部为 LEGACY_UNBOUND；partial/inconsistent = 0。
- 用户数量、ID 列表、角色记录和表数量保持不变。
- 第二次执行成功，证明该路径幂等。
- `CHECK TABLE users, user_role_bindings` = OK。

### 13.2 P3-history path

- DB：`camera_auth_migration_test_p3`
- 来源：只读复制 `camera_app` 表结构、不复制业务数据；最终证据使用 `mysqldump --no-data --no-tablespaces` 生成，位于 ignored `backend/target/a5-auth-schema/`。
- Before：52 tables；37 个指向 `users.id` 的外键；三个纯测试用户（820001、820002、820003）；2 role bindings；已有三个 mobile 字段和唯一索引；缺少 verified 字段。
- After：只补 `phone_verified_at`；原三个 mobile 字段和 `uk_users_mobile_hash` 保持兼容。
- 52 tables、37 个 users.id 外键、3 个用户 ID、2 个角色记录均保持不变。
- 三个用户全部为 LEGACY_UNBOUND；partial/inconsistent = 0。
- `CHECK TABLE users, user_role_bindings` = OK。
- 清理负向测试数据后再次执行成功，证明该路径幂等。

### 13.3 Constraint and negative verification

- UNIQUE 生效：相同的两个非空 64 字符 hash 插入返回 MySQL 1062；事务退出后原三个用户保持不变。
- 多 NULL 生效：三个 `NULL mobile_hash` 用户可共存。
- 重复预检生效：移除隔离库索引并制造两个重复测试 hash 后，migration 返回 MySQL 1644 / SQLSTATE 45000 / `DUPLICATE MOBILE HASH DETECTED`。
- 冲突时索引没有创建，三个用户均未被删除或覆盖。
- 清除纯测试 hash 后重跑 migration，唯一索引恢复。
- 派生状态验证：事务中制造一个 hash 非空但其他值为空的用户，结果为 LEGACY_UNBOUND 2、partial/inconsistent 1；回滚后恢复为 3 和 0。

## 14. Rollback

Rollback 必须在维护窗口、完成备份并确认迁移后是否已有真实手机号数据之后执行。

预检查：

```sql
SELECT COUNT(*)
FROM users
WHERE mobile_cipher IS NOT NULL
   OR mobile_hash IS NOT NULL
   OR mobile_masked IS NOT NULL
   OR phone_verified_at IS NOT NULL;
```

若结果非 0，必须先导出四字段与 `users.id` 的对应关系。直接删除字段会永久丢失迁移后新增的手机号身份数据。

两条回滚路径不同：

- Baseline 原先没有 mobile 字段：确认备份后，先删除 `uk_users_mobile_hash`，再依次删除 `phone_verified_at`、`mobile_masked`、`mobile_hash`、`mobile_cipher`。
- P3 历史库原先已有三个 mobile 字段和唯一索引：只删除 A5 新增的 `phone_verified_at`；不得删除历史 `uk_users_mobile_hash` 或三个 mobile 字段。

因此不提供自动统一 DROP 脚本，避免误删历史 P3 字段。回滚必须依据迁移前 schema 清单执行。

## 15. Existing FK compatibility

Migration 只对 `users` 做追加 nullable column 和 secondary unique index，不修改主键、不重排 ID、不删除数据、不重建表。P3-history 隔离库中的 37 个 users.id 外键在迁移前后数量一致，用户和 role binding 记录一致，表检查正常。

## 16. Risks

- 一手机号一账号尚未由 B 正式冻结，唯一索引不能进入生产发布。
- 手机号规范化不一致会使同一号码产生不同 hash，数据库无法自行纠正。
- HMAC key rotation 可能需要多版本 hash 或迁移窗口，当前 schema 未设计该业务。
- `phone_verified_at` 的权威事件未冻结，不能依据已有 hash 自动回填。
- partial/inconsistent 状态必须阻断自动归类，并由 B 给出处理策略。
- 本地 P3 schema 与 `V1_baseline.sql` 有差异，因此发布前必须识别目标数据库属于哪条路径。

## 17. Dependencies on B/C

B 负责冻结手机号唯一性、规范化与 hash、首次绑定、验证时点、初始角色、重新认证、Session 失效和 Logout 语义。

C 后续负责 Staging backup、Secrets、CI/CD 和经过批准的 migration 执行。HMAC/加密密钥不得写入 migration 或仓库。

## 18. Deployment boundary

标准流程：

```text
Local Old DB Copy Test
→ B 业务规则确认
→ PR Review
→ Staging Backup
→ Staging Migration
→ Verification
→ Production approval
```

本阶段不执行 Staging/Production migration，不修改服务器部署流程。

当前状态：

```text
AUTH Migration Design = STARTED
Implementation draft = locally verified
Production rollout = BLOCKED BY B INPUT
```
