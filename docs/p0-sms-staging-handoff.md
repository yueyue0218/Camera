# P0-SMS staging 接入交付

状态：IMPLEMENTED — PENDING SMS CONFIGURATION

本次仅完成本地代码和部署模板修改、人工源码审阅。未构建、未运行自动化测试、未调用短信接口、未修改数据库、未连接或修改线上环境、未重启服务。没有执行 Git 写操作。现有鸿蒙 P0-01/P0-02 工作区改动未触碰。

## 1. 审计结论及证据边界

- `AuthController` 已有 POST `/auth/sms/send`、`/auth/sms/verify`、`/auth/native/sms/verify`；验证码登录、自动注册、Refresh Token、退出登录均已有实现，本次不修改接口或 Token 体系。
- `pom.xml` 已依赖 `com.aliyun:dysmsapi20170525:4.6.0`；`AliyunSdkSmsGateway` 已真实调用 `Client.sendSms`，不是占位实现。代码完整不等于云端凭证、签名、模板和发送权限已经可用。
- 修改前阿里云 sender/gateway 只在 `prod` 注册。`dev`/`smoke` 使用 DevSmsSender；其他环境使用 DisabledSmsSender。仅设置 `SMS_PROVIDER=aliyun` 不能让原来的 temp-staging 发真实短信。
- 仓库部署模板指定 `SPRING_PROFILES_ACTIVE=temp-staging`。systemd 单元从 `/etc/portra/portra.env` 注入环境，以 `portra` 用户运行 `/opt/portra/app/app.jar`。这是仓库声明的部署方式；本次没有服务器实时进程、活动 Profile、已部署 JAR 或云控制台证据，不能断言服务器当前实际 sender。
- 已有服务器专用环境文件管理方式；仓库没有证明已接入 KMS/Secrets Manager，实际文件权限和密钥是否存在尚待管理员核实。

## 2. 修改后的选择条件

| Profile / 条件 | 行为 |
| --- | --- |
| `temp-staging` 或 `staging`，没有 `prod`，开关未设/false | DisabledSmsSender，不发送，不返回假成功 |
| 同上，`SMS_STAGING_ALIYUN_ENABLED=true`，provider 为 aliyun，配置有效 | 复用 AliyunSmsSender / AliyunSdkSmsGateway |
| 同上，启用但缺少参数或参数不合法 | 启动失败，仅提示配置名称，不输出值 |
| staging 混用 dev/smoke | 启动失败，防止使用开发验证码日志模式 |
| `prod` | 保留原有阿里云组件和 ProductionSecretsValidator；不受 staging 开关控制 |
| 独立 `dev` / `smoke` | 保留开发发送器和原有开发行为 |
| 其他 Profile | 禁用发送器 |

不要为开启短信把 staging 改成 prod，也不要将它和 prod/dev/smoke 混用。开发发送器仍会记录开发验证码；真实 staging 不使用此发送器。

## 3. 修改文件

- `backend/src/main/java/com/action/camera/auth/config/StagingSmsConfiguration.java`：新增 staging sender 工厂；默认关闭；启用前校验 provider、必填项、认证密钥、有效期/冷却时间；只记录 sender 名称。
- `backend/src/main/java/com/action/camera/auth/config/SmsProperties.java`：增加 staging 开关和验证码变量名，默认 false / code。
- `backend/src/main/resources/application.yml`：增加对应环境变量映射。
- `backend/src/main/java/com/action/camera/auth/sms/DisabledSmsSender.java`：staging 的禁用实例交由新配置创建，避免重复 Bean。
- `backend/src/main/java/com/action/camera/auth/sms/aliyun/AliyunSmsSender.java`：JSON 参数键由配置决定，默认仍为 code。
- `backend/src/main/java/com/action/camera/auth/sms/aliyun/AliyunSdkSmsGateway.java`：不再保留原始 SDK 异常 cause，避免异常链泄露敏感请求或凭证详情。
- `deploy/portra.temp-staging.env.example`：新增默认关闭的安全占位配置。
- 本交付文件。

## 4. 服务器配置清单

只在服务器受保护的 `/etc/portra/portra.env` 填值，不将实际值写入仓库、客户端、聊天记录或构建日志。保留该文件中的既有数据库/JWT等配置，不用示例文件整体覆盖它。

| 环境变量 | 所需值 / 来源 |
| --- | --- |
| SPRING_PROFILES_ACTIVE | 保持 temp-staging |
| SMS_STAGING_ALIYUN_ENABLED | 配置准备好并批准首次真实发送后改为 true；默认 false |
| SMS_PROVIDER | aliyun |
| SMS_ENDPOINT | dysmsapi.aliyuncs.com（现有中国站接口） |
| SMS_ACCESS_KEY_ID | 有发送权限的 RAM 身份 AccessKey ID |
| SMS_ACCESS_KEY_SECRET | 对应 Secret，仅安全写入服务器环境文件 |
| SMS_SIGN_NAME | 控制台审核通过的签名原文 |
| SMS_LOGIN_TEMPLATE_ID | 控制台审核通过的验证码模板 Code，通常 SMS_ 开头 |
| SMS_CODE_PARAMETER_NAME | 模板中验证码变量的精确名称，不含 `${}`；默认 code |
| SMS_CODE_PEPPER | 服务端安全生成、稳定保存的随机秘密；已有值必须保留 |
| PHONE_ENCRYPTION_KEY | 现有手机号加密密钥，Base64 编码的 32 字节，保留已有值 |
| PHONE_LOOKUP_HMAC_KEY | 现有手机号查询 HMAC 密钥，Base64 编码的 32 字节，保留已有值 |

手机号密钥和 pepper 不是阿里云提供的配置。不要随意轮换手机号密钥，否则既有账号可能无法匹配或解密。

本次支持一个验证码变量。需要确认已审核模板只要求该变量；若模板还要求其他变量，不能猜测其值，应先明确模板内容再补充映射，当前配置不能直接发送该模板。模板说明的有效期应与后端一致。

可选限制保留现有默认：SMS_CODE_TTL=5m、SMS_RESEND_COOLDOWN=60s、SMS_MAX_ATTEMPTS=5；手机号每小时/24 小时 5/20 次，IP 20/100 次，设备 10/50 次。对应变量为 SMS_PHONE_HOURLY_LIMIT、SMS_PHONE_DAILY_LIMIT、SMS_IP_HOURLY_LIMIT、SMS_IP_DAILY_LIMIT、SMS_DEVICE_HOURLY_LIMIT、SMS_DEVICE_DAILY_LIMIT。

## 5. 阿里云控制台核实项

取得 RAM AccessKey 对、已审核签名、已审核验证码模板 Code 和完整变量定义；确认购买的是当前 SDK 对应的短信服务、服务允许发送、余额/套餐可用及发送地域匹配。若使用测试专用签名/模板，确认测试号码绑定要求。

最小发送权限为 Action `dysms:SendSms`、Resource `*`，可由管理员建立专用 RAM 自定义策略；本次发送器不需要签名/模板管理权限。若凭证已有发送权限，无需重复授权。不要为了排障直接给账号所有权限。

官方依据：[SendSms 参数、授权与回执说明](https://help.aliyun.com/zh/sms/developer-reference/api-dysmsapi-2017-05-25-sendsms)。签名和模板必须审核通过，TemplateParam 的变量个数必须匹配模板。SDK 返回 OK 表示提交成功，实际送达还要看运营商回执。发生超时不能盲目重试，服务接口不提供幂等保证。

## 6. 后续由管理员部署与手动验收

以下步骤尚未执行，不代表本次部署授权。

1. 安全核实线上活动 Profile、JAR 版本、systemd 单元和环境文件路径，只查看需要的非敏感字段；不要导出完整进程环境或把环境文件贴到聊天。确认无启动参数覆盖 SMS 配置。
2. 由管理员将真实参数补入服务器环境文件并限制访问（如 root 所有、0600）；确认服务机能够解析并通过 HTTPS 访问短信 Endpoint。先保留开关 false。确认认证表结构已经存在，不在此任务内运行迁移。
3. 在后续获准的发布流程中构建/验证并部署包含本次改动的后端 JAR。仓库 `infra/staging/scripts/deploy-backend.sh` / `deploy-application.sh` 会切换版本并重启服务、做健康检查；本次未运行。不要把源码修改视为已经上线。
4. 准备首次人工验收时设置开关 true，管理员执行 `sudo systemctl restart portra-backend.service`，再检查 `sudo systemctl is-active portra-backend.service`。修改 EnvironmentFile 内容需要重启才会被新进程读取；仅修改 env 不需要 daemon-reload。现有 systemd 单元无需修改。
5. 启动日志应仅出现 `Staging SMS sender: aliyun`，缺少配置时应明确启动失败。不要启用 SDK HTTP 请求/响应或 Hibernate 参数绑定的详细日志。
6. 你本人在鸿蒙 staging 登录页用授权测试手机号点一次获取验证码；该操作会调用 POST `https://47.76.106.57/auth/sms/send`，请求字段保持 phone、purpose=LOGIN、deviceId。不要在控制台和客户端同时点击发送。结合手机收信和阿里云发送记录/回执确认送达。
7. 用收到的码走现有原生验证码登录，确认已有账号登录或新账号自动注册；重放同一码应失败。用后续单独获准的验证码检查超时拒绝、错误尝试上限；连续在 60 秒内获取应被拦截。首次测试失败先查云控制台，不连续重试造成费用。
8. 在既有客户端流程检查 Token 续期、退出登录，避免把认证契约变化误认为短信问题。若需关闭短信，将开关设 false 并由管理员重启；JAR 回滚不会自动回滚环境文件。

## 7. 验证码与异常处理审计

- SecureRandom 生成六位码，手机号规范化后，验证码经 HMAC-SHA256 pepper + BCrypt 保存；不存明文验证码。
- 只验证最新 challenge；默认 5 分钟；最多 5 次错误尝试；成功写 consumedAt；读取使用数据库悲观写锁，串行化同一 challenge 的验证，防止正常重复消费。
- 失败发送记录 FAILED 并立即过期，保留失败记录供限流统计；对外固定返回“短信暂时无法发送，请稍后重试”（现有 INTERNAL_ERROR），不透传云端错误或原始 SDK 异常。非 OK / 空响应 / SDK 异常均不能返回成功。
- 现有计数限流是先查询再写入，跨手机号共用 IP/设备的并发计数不是原子操作；没有历史 challenge 的首次请求也不能仅依赖已有行锁保证严格限流。最新记录只按 createdAt 排序，同时间记录存在排序边界。没有扩大本次范围修改这些逻辑。
- Nginx 转发 X-Forwarded-For，但 Controller 使用 request.getRemoteAddr()，仓库未显式配置可信代理解析策略；部署后可能按反向代理地址聚合 IP 配额。需核实实际请求来源解析，不能直接信任任意客户端转发头。
- 事务中包含短信网络调用，云端提交成功与数据库提交不是分布式原子操作。超时或数据库提交失败时可能收到无法使用的码；后续应先查询回执，不盲目重试。

当前不能确认真实短信已可发送：仍缺少真实云配置、审核/权限确认、线上活动配置核实、新版本部署以及你本人首次手动验收。以上是已实现能力与未验证条件的边界。
