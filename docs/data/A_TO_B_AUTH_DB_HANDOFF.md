# A → B AUTH DB HANDOFF

## Closure update — 2026-09-10

`B AUTH INPUT = RECEIVED AND FROZEN`

`A5/B DATABASE CONTRACT = INTEGRATED`

- A5 PR #7 merged at `e1d8e5e97117e3511ca3da23802db7f958744f59`.
- B's final contract is `docs/data/b-auth-final-contract.md`, status `FROZEN FOR INTEGRATION`.
- Unified main integration is `b8fd50da24b407ce9904f08d4ca442e2bdb92b83`.
- A reran both fresh and historical-schema migration paths on MySQL 8.0.41.

The former B-input blocker is closed. B does not owe additional database semantics for A first-stage closure.

Frozen rules now include one-phone-one-account, E.164 normalization, environment-keyed HMAC-SHA256, encrypted storage, all-NULL `LEGACY_UNBOUND`, atomic first binding/CUSTOMER assignment, reauthentication/rebinding, persistent Session/JWT invalidation, logout, hash-only SMS challenges, and revocable user sessions.

Both paths execute:

1. `migration/add_auth_phone_account.sql`
2. `migration/add_phone_auth_sessions.sql`

Final local results:

- Path A: 13/13 scripts, 39 tables, AUTH tables 2/2, plaintext phone columns 0;
- Path B: 17/17 scripts, 56 tables, duplicate hash groups 0, partial identity rows 0, plaintext phone columns 0;
- migration/schema contract tests: 18 passed, 0 failed, 0 errors, 0 skipped.

Real staging/production data remains subject to C's backup and release preflight.

The original handoff request below is retained as historical evidence and is superseded by this closure update.

---

## Historical handoff request

## 1. A 当前已经完成的内容

- A 第一阶段数据库工作已完成。
- ServicePackage P0 = DONE，PR #5 已合入 main。
- Demand Optimization = DONE，PR #6 已合入 main。
- AUTH DB design = STARTED。
- A5 migration draft 已在两个隔离 MySQL 路径完成本地验证。
- A5 Draft PR #7 当前为 open draft，未合入 main。

本次 Current Main Schema Sync 不会代替 B 决定手机号认证业务规则，也不会把 A5 草案提前写入 main fresh-init。

## 2. A5 当前数据库契约

Proposed:

| Column | Type | Nullable | Default |
|---|---|---:|---|
| `mobile_cipher` | `VARBINARY(512)` | YES | NULL |
| `mobile_hash` | `CHAR(64)` | YES | NULL |
| `mobile_masked` | `VARCHAR(32)` | YES | NULL |
| `phone_verified_at` | `DATETIME(6)` | YES | NULL |

约束边界：

- `users.id` 不改变。
- 不重建 `users`，不改变现有 users.id 外键图。
- 采用 nullable rollout，兼容历史账号。
- 不增加明文手机号列。
- 不给旧用户生成 fake phone、fake hash 或 fake verified time。
- `LEGACY_UNBOUND` 仅是 migration compatibility 派生状态：四列全部为 NULL。
- 部分列非 NULL 的历史记录属于 partial/inconsistent legacy state，不能归类为 `LEGACY_UNBOUND`。
- `uk_users_mobile_hash` 已完成草案和隔离库验证，但 staging/production rollout 必须等待 B 确认 one-phone-one-account。

## 3. B 必须冻结的规则

B MUST FREEZE:

1. **one phone one account**：决定 `UNIQUE(mobile_hash)` 是否能进入 staging/production；若允许多账号共享号码，则该唯一约束不可发布。
2. **normalization format**：决定进入 cipher/hash 前的唯一规范形式；国家码、空格、横杠处理差异会制造重复或不可查记录。
3. **SHA-256 vs HMAC-SHA256**：决定 `mobile_hash` 的生成契约、安全属性和跨环境可比性。
4. **HMAC key / rotation**：决定密钥来源、版本迁移、双读/重算需求；若要轮换，可能需要额外版本字段或迁移阶段。
5. **old account first binding**：决定旧用户何时、如何从全 NULL 状态写入手机号数据，是否需要冲突检查或人工恢复通道。
6. **verified write timing**：决定 `phone_verified_at` 的原子写入时点，以及验证码成功与账号状态落库的事务边界。
7. **CUSTOMER assignment timing**：决定手机号验证前后 `current_role` / `user_role_bindings` 的写入顺序和一致性要求。
8. **reauth conditions**：决定修改或解绑手机号前是否需要持久化挑战、最近认证时间或审计信息。
9. **Session/JWT invalidation**：决定绑定、换绑、禁用、密码变化后是否需要 session/token 持久化字段、版本或失效索引。
10. **Logout semantics**：决定登出是否仅客户端丢弃 token，还是必须持久化撤销记录及其过期清理策略。

这些规则会直接影响 column、unique、index、backfill、transaction 和 rollback，A 不会代替 B 推断。

## 4. B 的数据库同步责任

当前正式配置是 `spring.jpa.hibernate.ddl-auto=none`。

如果 B 的 AUTH-002 新增任何 Entity、Repository、table、column、index、unique 或 FK，B 的同一个 PR 必须同步：

- `backend/src/main/resources/db/migration/`
- 正式 Path A fresh-init SQL
- `backend/src/main/resources/db/README_EXECUTION_ORDER.md`
- 相应 Migration Contract Test

禁止只改 Java、依赖 Hibernate 自动建表，或在服务器手工 ALTER。

## 5. B 新增 Session / SMS 表要求

如果 B 新增 `session`、`refresh_token`、`sms_verification`、`auth_challenge`、`login_attempt` 或类似持久化结构，必须同时提供：

- fresh `CREATE TABLE` 和旧库 migration；
- 主键及 users.id 外键策略；
- 业务查询索引和唯一约束；
- expiration/cleanup 索引；
- 过期、消费、重试、并发和幂等语义；
- 数据保留/清理策略；
- 回滚与部署前验证 SQL；
- fresh-init 与 old-schema migration 的等价性测试。

## 6. A 等待 B 的最终输入

A5 final rollout review will happen after B freezes AUTH rules.

B 完成规则冻结并合入 AUTH-002 后，请通知 A：

1. 审核 A5 Draft PR #7 是否仍匹配最终规则；
2. 更新 migration、fresh-init 和执行顺序；
3. 重新执行 fresh-init 与 old-schema consistency audit；
4. 再决定 staging/production rollout，而不是直接合并当前草案。
