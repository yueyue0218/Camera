# Portra 默认方案安全复用：审核交付

基线：0603d42acdc8097ca634668c087e0a4cd861b894。
DEFAULT_SCHEME_SECURE_REUSE = PASS（本地实现与定向验证；不是服务器启动许可）。

## 实现

- SecureRandom 生成六位验证码；PNVS 发送实际值，默认方案对 LOGIN/REAUTH 通用。
- SMS_CODE_PEPPER 参与 HMAC-SHA256，随后 BCrypt；绑定 UUID challengeId、手机号哈希、
  purpose、账号、会话、操作。数据库只保留哈希，不保存验证码明文。
- REAUTH 只开放 ACCOUNT_CLOSURE，绑定已认证账号及当前会话；原账号绑定手机号、
  管理员禁止自助注销、未完订单/争议检查、隐私授权链路均保留。
- API 返回 challengeId/expiresAt；登录和注销确认必须提交 challengeId。没有“最新验证码”回退。
- 数据库范围锁覆盖手机号/IP/设备的首次和并发发送；手机号锁及挑战行锁保证单次消费。
- 新发送获准后使同手机号同用途旧挑战失效，发送失败不恢复旧挑战；未获准的限流请求不改旧挑战。
- REQUIRES_NEW 独立提交消费和错误次数。业务失败或响应丢失后需要重新获取验证码，不能恢复旧码。
- 自定义码不再调用 CheckSmsVerifyCode。DevSmsSender 和 SmsMessage.toString 不输出明文。
- 旧 Java 方法仅保留失败关闭的兼容入口，不被控制器使用；旧客户端必须升级。

## 最小迁移与兼容

新增文件：backend/src/main/resources/db/migration/V20261103__sms_challenge_binding.sql。
仅审核，未执行服务器 SQL。显式限定 portra_integration，不允许应用启动时执行。
sms_challenges 新增 challenge_id、owner_user_id、owner_session_id、operation、invalidated_at，
challenge_id 唯一索引；新增 sms_challenge_locks。实体数由 37 变为 38。
旧记录 challenge_id=NULL，新服务一律拒绝；无须重跑既有 17 项 SQL。
应用保持 DML-only、Hibernate validate、SQL init never、runtime DDL false。
新旧 JAR 不可同时服务同一验证码状态；回滚也不得静默恢复旧云端校验模式。

Web/Harmony 登录源码已同步，但本次不构建/发布客户端。基线没有注销客户端实现；
外部注销客户端需按新的响应、请求契约接入。

## 定向验证（全部本地、无真实短信、无服务器访问）

|验证|结果|
|---|---|
|DefaultSchemeChallengeSecurityTest|14/14，包括跨用途、跨账号/会话/手机号/操作、替换失效、消费重放、6线程并发、发送失败、错误次数/过期/限流，以及真实注销清理失败后的消费不回滚|
|DefaultSchemeLocalCodeSenderTest|2/2，包括同默认方案/同模板、实际验证码参数、禁止云端校验、日志不泄露验证码|
|DefaultSchemeChallengeApiTest|3/3，包括响应挑战ID、两条登录路由缺ID拒绝、ID传递|
|infra/integration-secure-sms/test-gate.py|6/6，放宽方案/模板限制，保留其他门禁|
|harmony/tests/default-scheme-challenge.test.cjs|2/2，执行 Web/Harmony API 代码验证 ID 传递|
|Maven package|成功，跳过测试；JAR SHA256 见最终包 PROVENANCE.json|

首次测试两项重发夹具因 created_at 不可更新而触发冷却，改为测试库中更新时间后通过。
定向并发测试使用 H2 MySQL 模式；没有声称完成真实 MySQL 并发、实网 PNVS 或客户端完整构建验收。
既有全量/历史测试未重跑；旧签名、云端验码及37实体断言属于旧契约，不能作为本实现的验收依据。
不会使用历史云端成功记录替代当前 JAR 的实网发送验收。

## 部署包同步

infra/integration-secure-sms 是基线最终部署包脚本的可版本化模板。
更新环境检查：允许省略或使用默认 REAUTH 方案，允许 LOGIN/REAUTH 使用相同已审核模板；
REAUTH 模板仍不能为空。其余密钥、SMTP、隐私版本、覆盖限制不变。
模板固定在新提交对应的独立发布目录；JPA helper 更新为38实体；新增迁移仅供审核，部署脚本不执行它。
打包脚本同步新JAR、提取运行库、编译验证工具、生成来源说明和两层SHA256SUMS。
原0603d42a最终包原样保留。

READY_TO_START_8081 = NO：尚需人工批准迁移、客户端兼容发布及SMTP/独立密钥/隐私等配置验收。
未修改8080、portra_staging、Nginx、原上传目录；未部署/启动/推送/合并main。
