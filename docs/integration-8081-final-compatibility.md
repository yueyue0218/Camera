# 8081 三线候选审核（2026-11-04）

范围：仅本地独立候选 `codex/portra-final-compatibility`；未更新 PR、推送、部署、启动服务或执行服务器 SQL。

## 提交关系及合并决策

PR #32 基线 `9196bf9a9a291a8e37dc977e495093a5a32f5283` → DDL 修复 `0603d42acdc8097ca634668c087e0a4cd861b894` → 默认方案安全复用 `89428a74fed7ddb45feacbc295649b7beafac9be`。
候选在该链上合入 UI 分支 `db878e1a85ce8862a76c3747163ad8bfda8161f2`，保留两条父链。没有 squash/cherry-pick 遗漏风险。

22 个冲突的解决原则：

- 后端短信、注销 DTO/controller/service、隐私授权、配置与部署门禁：保留 89428 的 challenge、本地校验、账户授权和隔离保护。
- 两个后端测试文件：保留账户授权测试；移除自动合并产生的重复 `mvc` / `sessions` 字段。
- Web package.json 合并 privacy/province 测试入口；ProfilePage 保留 UI 分支完整省份导入。
- Harmony LoginPage 同时保留新 challengeId 与 UI 分支的 sessionVersion、页面生命周期和协议阅读保护。
- 其他自动合并内容保留 UI 分支成果；消息、订单、发布等业务页面不做重写。

新增兼容修复仅涉及 Harmony 登录发码响应校验、PrivacyApi 的 REAUTH 响应和请求、PrivacySettingsPage 挑战绑定及会话回调保护。注销提交前释放本地挑战，未知结果或失败不能自动重用可能已消费的验证码；必须重新发码。旧会话的迟到注销成功不清除新会话。

## 增量迁移静态验收

审核对象：`backend/src/main/resources/db/migration/V20261103__sms_challenge_binding.sql`，与 89428 原文件一致。

- 仅对 `portra_integration.sms_challenges` 增加五个 nullable 字段和 `uk_sms_challenge_id`，另建 InnoDB `sms_challenge_locks`。
- 无 DELETE、DROP、TRUNCATE、UPDATE，无原字段修改，无既有索引/外键移除。17 项既有迁移不重跑。
- 原记录保留，新增 challenge_id 为 NULL；唯一键允许多条 NULL；新服务拒绝没有 challengeId 的旧挑战。无需填造 UUID 或重新启用旧验证码。
- 新锁表主键 `lock_key VARCHAR(64)` 对应第 38 个 JPA 实体；INSERT IGNORE 加 SELECT FOR UPDATE 用于跨实例串行化。应用仅需现有 integration 范围 DML 权限。
- ALTER 会取得 MySQL 元数据锁，不能承诺零锁表；在 8081 尚未启动且 integration 无其他写入者的窗口执行，先检查长事务/锁等待，设置有界等待，不终止未知会话。
- MySQL DDL 存在隐式提交，两个语句整体不具事务回滚语义；脚本不幂等，禁止失败后盲目重跑。

## 待批准的一次性执行与 38 实体验收方案

以下为方案，本轮没有执行任何数据库连接或 SQL：

1. 审批具体 migration 文件及 SHA256；确认 8081 未运行、无 integration 写入者，使用仅能访问 portra_integration 的迁移凭据。备份 integration 的表结构、sms_challenges 数据及原17项验收证据；不复制/打印密钥。
2. 只读确认 DATABASE()、CURRENT_USER()、information_schema 中五个字段、唯一索引、锁表及其结构；记录原表行数和原索引。全部缺失才允许执行完整两语句。
3. 若全部已存在且精确匹配，跳过 DDL，转验收；若部分存在，停止完整脚本。核对已完成部分的类型/长度/nullability/索引列序，审批仅缺失部分的单独 DDL。结构不符时停止，不自动修表。
4. 在受控窗口仅执行本 migration。完成后比对原行数、原主键和既有字段/索引，新增字段应匹配实体，唯一索引确为 UNIQUE(challenge_id)，锁表为 InnoDB、PRIMARY KEY(lock_key)。Hibernate validate 不覆盖全部索引语义，不能省略这些检查。
5. 使用 `infra/integration-secure-sms/ValidateJpa.java`，配合对应后端产物的 BOOT-INF/classes/lib，独立运行元数据验证器。它不启动 CameraApplication、HTTP、runner 或短信发送，固定指向 portra_integration/portra_int_app，先验证 DML-only grants，再使用 hbm2ddl=validate。只由服务账户通过已有受保护环境加载密码。
6. 必须取得 `APP_GRANTS_PASS DML_ONLY` 和 `JPA_VALIDATE_PASS entities=38 database=portra_integration user=portra_int_app`，保存退出码及日志。任一步失败停止；不调用 deploy-once.sh（它后续会启动8081），不以启动应用代替验收。

静态扫描确认38个实体；尚未执行服务器38实体 JPA 验证，不能将此文作为已迁移证明。

## 协议与混跑边界

新客户端发码必须收到对象 challengeId；新后端验证/注销请求必须包含 challengeId。旧客户端缺少字段会被拒绝；旧后端 boolean 发码响应在新客户端失败关闭。LOGIN 与 ACCOUNT_CLOSURE REAUTH 保持服务端用途、手机号、账号和会话约束；隐私授权不绕过。

禁止同一 integration 数据库/路由池混跑旧云端校验后端与新本地校验后端；旧实例没有新挑战语义，不能靠客户端字段补救。未来升级需整体切换专用8081目标及对应客户端，旧客户端需要升级。回退也需停新目标、清除客户端待验证状态并等待全部挑战超过配置 TTL；不在滚动混跑中继续验证。8080保持原环境和数据库，不加入8081路由池。

Web 当前没有自助注销页面，本轮未新增产品页面。覆盖现有 Web 登录/隐私退出链、Harmony 登录/自助注销链和后端注销 HTTP 合约。测试替换网络边界，不代表真实 PNVS 发码或真机联调通过。

## 验证和 PR 更新条件

- Web：真实 React 页面 → authApi → AuthProvider 的4项挑战用例，另3项隐私门禁/退出用例。
- Harmony：生产页面方法 → ApiService/PrivacyApi 的8项挑战用例，8项隐私设置行为与8项账户授权同步回归。
- 后端：仅新增 IntegratedClosureContractTest 的3项 HTTP JSON → 注销服务测试；不连接数据库。全部后端测试源码参与编译，未重跑既有27项短信测试。
- Web production 构建；Harmony staging ArkTS 编译及未签名 HAP 打包。编译使用占位 HTTPS loopback，不向8081发送请求，不安装应用。
- 构建警告：Web 已有大 chunk；Harmony 已有 API 废弃/可抛异常警告、无签名配置。签名与安装不属于本候选兼容性验收。

PR #32 更新可在审核后把原 head 分支快进至此候选（须先重新确认远端head未变化），不可 force-push 或重新覆盖组员分支。本轮不执行。DDL、部署保护及客户端修改均由候选父链完整保留。新部署包未来须引用审核后的候选、包含本 migration 和38实体验证器、同步双端 challenge 协议；现有已生成包不在本轮自动重建或部署。
