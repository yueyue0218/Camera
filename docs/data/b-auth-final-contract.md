# B AUTH 最终冻结契约与 A5 反馈

状态：**FROZEN FOR INTEGRATION**

日期：2026-09-08
依据：B AUTH-002 已完成实现、A5 `add_auth_phone_account.sql` 已合入 `main`，双方按本文件统一。

## 1. 一手机号一账号

确认。规范化后的同一手机号只能绑定一个 `users.id`；唯一约束建立在
`users.mobile_hash`，名称固定为 `uk_users_mobile_hash`。历史未绑定账号保持
`mobile_hash = NULL`，MySQL 唯一索引允许多个 `NULL`。

## 2. 规范化格式

唯一规范值为 E.164。当前首发支持：

- 大陆 11 位号码、`86`、`+86`、`0086` 输入统一为 `+86...`；
- 输入阶段移除空格、半角横杠和圆括号；
- 最终必须匹配 `+[1-9][0-9]{7,14}`；
- hash、加密、短信发送和验证码校验必须使用同一个规范化结果。

## 3. Hash 算法

固定为 **HMAC-SHA256**，输入是规范化 E.164 的 UTF-8 字节，输出为 64 位小写十六进制。
禁止使用无密钥 SHA-256，避免对有限手机号空间进行离线枚举。

## 4. 密钥与轮换

- `PHONE_LOOKUP_HMAC_KEY`：每个环境独立的查询 HMAC key；
- `PHONE_ENCRYPTION_KEY`：每个环境独立的 AES-256-GCM key；
- 两个 key 只由运行环境 Secret Store 注入，禁止进入 Git、日志、客户端或迁移 SQL；
- `mobile_cipher` 使用带版本头、随机 96-bit nonce 和认证标签的二进制信封；
- 首版使用版本 1。轮换在维护窗口暂停手机号注册/换绑，解密全部非空记录、重算、检查重复后原子切换；
  不在本次引入双写列或多版本唯一索引。

## 5. 旧账号首次绑定

- 四个手机号字段全 NULL 的账号属于 `LEGACY_UNBOUND`，不生成 fake phone/hash/verified time；
- 普通手机号登录不会依据昵称、学号或其他弱标识自动合并旧账号；
- 旧账号绑定必须同时通过新手机号短信验证和旧账号凭据/人工恢复校验；
- 写入前锁定目标用户并检查 `mobile_hash` 唯一性，在同一事务写入 cipher/hash/masked/verified；
- 如手机号已属于其他账号，停止并进入人工恢复，禁止自动合并 users.id 或业务数据。

## 6. verified 写入时点

验证码成功消费是唯一权威事件。消费挑战、创建/更新用户手机号身份、写
`phone_verified_at`、写 `last_login_at`、补 CUSTOMER binding 和创建 Session 必须处于同一业务事务；
任一步失败则整体回滚，不允许仅 hash 非空却已标记 verified。

## 7. CUSTOMER 分配时点

新账号在验证码成功后创建，随后在同一事务先写 `user_role_bindings(CUSTOMER)`，再把
`current_role` 设置为已绑定的 CUSTOMER，最后创建 Session。请求参数不能授予 PROVIDER/ADMIN。

## 8. 重新认证与换绑

手机号修改/解绑属于高风险操作，要求：有效服务端 Session、最近一次认证和目标新手机号短信验证。
换绑前锁定用户并检查新 `mobile_hash` 未被占用；成功后撤销该用户所有旧 Session，再签发当前设备的新 Session。
首版未开放解绑为无登录标识的状态；账号注销走独立数据生命周期流程。

## 9. Session/JWT 失效

- 账号禁用：拦截器下一次请求立即拒绝；
- 手机号首次绑定、换绑、管理员密码变化或安全恢复：撤销该用户既有 Session；
- Access JWT 必须包含并校验 `sub`、`sid`、`iat`、`exp`，且每次访问校验服务端 Session；
- Refresh Token 只保存 SHA-256 hash，刷新时轮换，旧值重放会撤销对应 Session。

## 10. Logout 语义与清理

Logout 必须持久化设置当前 Session 的 `revoked_at/revoke_reason`，并清除客户端凭据。
Web 清除受限路径的 HttpOnly Cookie；HarmonyOS 清除 Asset Store 中的 Refresh Token。
后台任务依据 `idx_user_sessions_expires_at` 和 `idx_sms_expires_at` 清理过期数据，保留周期由运维策略配置。

## 11. Web 与 HarmonyOS Token 交付

- Web：Access Token 仅内存；Refresh Token 只写 HttpOnly + Secure + SameSite Cookie；
- HarmonyOS：Access Token 仅内存；Refresh Token 写入 Asset Store，加密、按环境隔离且禁止设备同步；
- 两端共享同一 `user_sessions`、轮换、撤销和重放检测语义；
- 原生 Refresh Token 通过明确的 native transport 返回/提交，服务端结合受信任 Origin 规则，不能只相信客户端自报角色或平台。

## 12. 迁移所有权与顺序

1. `migration/add_auth_phone_account.sql`：A 负责 users 的 mobile 三字段、verified 字段和 hash 唯一索引；
2. `migration/add_phone_auth_sessions.sql`：B 负责 `last_login_at`、`sms_challenges`、`user_sessions` 及业务索引；
3. B 脚本不得再创建明文 `users.phone` 或 `uk_users_phone`；挑战表只持久化 `phone_hash`；
4. 两个脚本在 fresh-init 和旧库升级路径都按上述顺序执行，并在新 JAR 启动前完成；
5. 迁移发现重复 hash、partial/inconsistent identity 或非空遗留明文 phone 时必须停止，不得静默覆盖、删除或合并用户。
