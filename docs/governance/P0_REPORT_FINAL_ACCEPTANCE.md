# PORTRA-GOV-P0-CLOSURE 最终验收报告

首轮日期：2026-10-09；MySQL 补验及最终回归：2026-10-10（Asia/Shanghai）。结论：**BLOCKED（MySQL 闸门已解除，指定构建命令条件仍未收口）**。

仓库：https://github.com/yueyue0218/Camera
分支：`codex/p0-report-entry-closure`
HEAD / 基准：`4f844d27750dd38ce2e761c097c59f741afff76e`
工作目录：`C:\Users\LiXiaozhou\.codex\worktrees\p0-report-entry-closure\Camera`。

## 1. 执行摘要

| 状态 | 实际结果 |
|---|---|
| 已完成 | 首轮13文件审计及最终16文件审计、两项P1举报保护、前端4条回归、Socket/HTTP排障、独立HTTP联调、真实MySQL七项契约验收、测试夹具复审修复、本报告 |
| 已验证通过 | 前端 90/90、前端构建；隔离进程中默认 HTTP 客户端的完整 Maven verify（最终751总数、749通过、2原有跳过，打包与覆盖率通过）；其中原举报专项39/39；三类浏览器举报和D1～D4的30个真实HTTP检查；MySQL专项29/29及隔离保护3/3 |
| 未验证 | 生产部署、长期压力、全部页面断点/全部原业务交互；独立HTTP联调仍是首轮H2环境，MySQL业务验证在真实Spring事务/MockMvc环境完成 |
| 已知失败 | 默认进程下指定 verify 命令仍有 55 个 Socket 错误；隔离 Socket 条件后指定 `-Dspring.http.client.factory=simple` 命令仍有 1 断言失败 + 6 客户端错误 |
| 尚待人工操作 | 确认正式验收使用支持PATCH/Origin的客户端与隔离运行参数；对16文件进行人工代码审查并决定合并；本轮未授权共享配置变更 |

没有确认新的 P0 安全或业务一致性缺陷。两项本轮确认的 P1 举报风险已修复并复审。MySQL关键验收已经实际完成。指定simple命令的首轮失败仍未解除，不能用默认客户端verify成功改写该失败。

本轮没有提交、暂存、推送、合并、创建 PR，没有进入 P0-E/P0-F/P1/P2。没有改动后端生产代码、认证、订单、支付或共享配置/CI。原始 Camera 目录仅执行只读 status，其原有 3 个修改文件和 6 个未跟踪目录/文件项保持一致。

## 2. Git 差异审计

首先实际执行了：

```powershell
git status --short
git branch --show-current
git rev-parse HEAD
git diff --stat
git diff --check
git diff --name-status
git ls-files --others --exclude-standard
git diff --cached --stat
```

初始正好 13 文件：5 修改、8 新增；暂存区为空。HEAD 未变化。首轮增加本报告后为14文件；本次MySQL补验再新增两份测试源码，最终共 **16文件（5修改、11新增）**。以下路径相对本工作目录；新增文件均单独全文审查，未将 `git diff --stat` 当作全部变更。

| 状态 | 文件 | 原因及其他模块影响 |
|---|---|---|
| M | frontend/package.json | 将举报测试纳入 npm test；增加两个开发测试依赖，生产依赖未变 |
| M | frontend/package-lock.json | 锁定测试依赖及 47 个新增开发包；全部新增项为 dev，现有包版本均未变化 |
| M | frontend/src/pages/hall/HallDetailPages.jsx | 两处新增举报入口与真实 ID/路由一致性保护；原加载、响应、预定、编辑等处理函数未改 |
| M | frontend/src/pages/profile/PublicProfilePage.jsx | 新增用户举报入口及 ID/路由保护、局部 crumb 类名；原资料/消息/关注逻辑未改 |
| M | frontend/src/pages/profile/profile.css | 只增加 3 行局部样式，预留更多按钮位置并允许文字换行 |
| A | frontend/src/api/reportApi.js | 对已有 POST /reports 的薄封装，复用原 client，无重复服务端 API |
| A | frontend/src/components/reports/ReportAction.jsx | 更多菜单、本人/无效目标隐藏、焦点返回、成功提示 |
| A | frontend/src/components/reports/ReportDialog.jsx | 原因/补充说明、UTF-16 长度、提交锁、错误反馈与草稿保留 |
| A | frontend/tests/reportEntry.test.mjs | 真实页面/组件/client DOM 回归；仅替代网络边界，不冒充 HTTP 联调 |
| A | backend/src/test/java/com/action/camera/integration/ReportClosureIntegrationTest.java | 原15项Spring/H2闭环；4个私有测试辅助方法改为包可见供MySQL子类复用，原测试不删不改断言；无生产代码改动 |
| A | backend/src/test/java/com/action/camera/integration/ReportMySqlClosureIT.java | 显式执行的29项真实MySQL验收；继承15项原闭环，新增14项契约/强制竞争/审计/回滚验证；启动前拒绝错误实例，DDL关闭，MockMvc不打印令牌 |
| A | backend/src/test/java/com/action/camera/integration/ReportMySqlIsolationGuardTest.java | 3项启动前隔离保护单元回归；只模拟JDBC以验证拒绝及检查顺序，不能代替真实MySQL业务验收 |
| A | docs/governance/P0_REPORT_AUDIT.md | 首轮契约审计和收口报告指引 |
| A | docs/governance/P0_REPORT_IMPLEMENTATION.md | 首轮实现记录和收口报告指引 |
| A | docs/governance/P0_REPORT_TEST_REPORT.md | 保留首轮失败与风险证据，指向本轮新结果 |
| A | docs/governance/P0_REPORT_FINAL_ACCEPTANCE.md | 本轮最终验收、剩余阻塞、人工操作要求 |

所有诊断脚本、临时 HTTP 夹具、编译结果和日志在既有忽略的 `backend/target/closure-audit`、`backend/*.log` 或 `frontend/*.log` 下，没有额外未申报的交付源码。独立MySQL数据及受限配置在 `C:\Users\LiXiaozhou\.codex\test-environments\portra-mysql-3307`，位于仓库与Maven构建目录之外；不提交凭据。没有写入测试密钥或有效令牌到交付文件。测试中的 `test-access`、自行构造的过期 JWT 是不可用的受控测试输入。新增生产代码没有 console/debugger、X-User-Id、令牌/表单日志。没有全页重构或批量格式化。

两个依赖的用途：`@testing-library/react` 运行实际 React 页面和可访问交互，`jsdom` 提供 DOM；jsdom 锁定 26.1.0，未使用不兼容现有 Node 20 CI 的新主版本。锁文件较大主要来自这 47 个开发依赖，不是升级生产库。

### 发现、证据与修复

| 分级 | 位置 | 复现证据 | 本轮修复及限制 |
|---|---|---|---|
| P1，已修复举报风险 | PublicProfilePage.jsx:264；原 load:52～78 | A 资料成功后导航 B，B 的 public-profile/brief 都失败；原状态保留 A，页面 UID 是 B，新入口会举报 A。修复前测试 reportEntry.test.mjs:189 失败 | 仅当返回 userId 与当前 profileUserId 一致才生成入口；仍传实际返回 ID，不猜主键 |
| P1，已修复举报风险 | HallDetailPages.jsx:700；原 load:563～569 | A enrichment 挂起，B 完成后 A 迟到覆盖 service；修复前 reportEntry.test.mjs:207 失败 | 仅当 service.serviceId 与 serviceId 路由一致生成入口。需求入口:365 同样防御 |
| P1，既有状态问题未修 | 上述既有加载函数 | 回归刻意保留旧资料/迟到覆盖，证明举报入口消失；原页面展示及其他原操作仍可能消费旧对象 | 不宣称修复了整个页面加载。这属于其他既有业务行为，本轮没有擅自重构；建议负责人单独处理取消检查/清理旧状态 |

独立只读 reviewer 复审了上述保护与 4 条新回归，未发现新的举报阻塞缺陷；reviewer 没有代替主任务运行测试或做 HTTP/MySQL 验证。

## 3. 业务代码复核

- DEMAND：`demand.demandId` / `demand.customerId`；SERVICE_PACKAGE：`service.serviceId` / `service.providerId`；USER：`publicProfile.userId` / 同一 ID。后端 DTO/mapper 的实际所有者字段也核对过。有效正整数且为 JS safe integer才显示入口；三页面同时要求目标返回 ID 与路由一致。
- 本人判断按 userId 与真实 ownerId，不按前端 role 字符串；后端 ReportTargetValidator 独立禁止自报、自有内容和不存在/不可见内容。前端隐藏不能替代服务器权限。
- 组件按真实 target ID 设置 key，页面加载卸载和弹窗 open/target 变化清空新对象草稿；失败保留当前草稿。同步 pending ref 在 await 前加锁，提交期间禁用再次提交、取消、Escape/backdrop；菜单与弹窗退出后恢复焦点。
- 成功仅在真实 client 无错误返回后提示；40101/40301/40401/40901/40902/40001 和网络失败有对应反馈，不吞成成功。未登录没有请求。错误不能绕过服务器验证。
- 原因来自固定枚举，后端最长 500；说明最长 1000，JS `.length`/slice/maxLength 与 Java String.length 均按 UTF-16。新增 500 emoji（1000 单元）完整提交边界测试。
- reportApi 复用原 request、Bearer 与 credentials include。`skipTokenExpiryCheck` 仅略过本地 JWT exp 预判，让请求到服务器；`suppressAuthTimeout` 仅阻止全局重定向/认证超时事件，让弹窗保留草稿。两个参数被 client 解构，不传进 HTTP payload。服务器仍解析 JWT、检查有效 session、ACTIVE 用户与角色绑定；本轮没有改这一校验链。
- 新增过期 JWT 回归（reportEntry.test.mjs:241）确认请求确实到达服务器边界，Authorization 保留，40101 提示登录，草稿仍在，全局 timeout 事件为 0，没有成功提示；真实 HTTP D3 又确认受限旧会话被后端拒绝。尚未自动跳转登录，提示后由用户自行登录，属于当前产品反馈策略。

## 4. 测试环境、命令与结果

Windows 11 amd64；Oracle JDK 17.0.12；Maven 3.9.16；Node 24.15.0；Tomcat 10.1.54；H2 2.3.232。没有删除/屏蔽失败测试，也未使用 skipTests。2 个跳过来自原有 MySQL A2 用例：

- ServicePackageA2MySqlSmokeTest.recommendationUsesFixedSevenSqlStatementsForAllFrozenCandidates
- ServicePackageA2MySqlSmokeTest.sameA1RequestUsesFixedEightSqlStatementsAgainstFrozenMySqlDataset

以下日志位于本 worktree；后台原始命令均等待退出并核对结果。

| 命令/运行条件 | 总数 | 通过 | 断言失败 | 错误 | 跳过 | 结果与日志 |
|---|---:|---:|---:|---:|---:|---|
| npm run test:reports，修复前新路由回归 | 20 | 18 | 2 | 0 | 0 | 红灯；frontend/report-closure-red.log |
| npm test，最终 | 90 | 90 | 0 | 0 | 0 | exit 0；frontend/report-closure-frontend.log；10+42+2+9+5+22 |
| npm run build，最终代码 | — | — | — | — | — | exit 0；frontend/report-closure-build.log |
| 修改前 mvn test -Dsimple（首轮日志） | 733 | 676 | 0 | 55 | 2 | 失败；backend/target-baseline.log |
| 本轮 mvn verify '-Dspring.http.client.factory=simple'，默认进程 | 748 | 691 | 0 | 55 | 2 | exit 1；backend/target-closure-default-verify.log |
| 同一指定命令，隔离 NIO Pipe 参数 | 748 | 739 | 1 | 6 | 2 | exit 1；backend/target-closure-isolated-verify.log |
| mvn verify，隔离 NIO Pipe 参数、默认 HTTP 客户端 | 748 | 746 | 0 | 0 | 2 | exit 0，BUILD SUCCESS；backend/target-closure-jdk-verify.log |

MySQL补验及最终回归另实际执行：

| 命令/阶段 | 总数 | 通过 | 断言失败 | 错误 | 跳过 | 结果与日志 |
|---|---:|---:|---:|---:|---:|---|
| 初始MySQL IT | 28 | 28 | 0 | 0 | 0 | exit0；target-closure-mysql-it.log；复审后加强，不作为最终竞争证据 |
| 隔离保护，修复前 | 3 | 0 | 3 | 0 | 0 | 预期红灯；target-closure-mysql-guard-red.log |
| 隔离保护，修复后 | 3 | 3 | 0 | 0 | 0 | exit0；target-closure-mysql-guard-green.log |
| 加强IT，仓库代理协调器初次运行 | 29 | 26 | 3 | 0 | 0 | 保留夹具失败；target-closure-mysql-final-it.log |
| 最终显式MySQL+保护测试 | 32 | 32 | 0 | 0 | 0 | exit0；target-closure-mysql-acceptance.log；29真实MySQL+3保护 |
| 最终完整mvn verify，隔离参数+默认客户端 | 751 | 749 | 0 | 0 | 2 | exit0，打包/覆盖率通过；target-closure-mysql-final-verify.log |

上述日志相对backend目录。最终XML按本次日志实际运行的类汇总，排除上次显式IT遗留XML，不把29项IT混入751项默认套件。`target/closure-audit/mysql-final-verify-summary.json`保存751项明细；`target/closure-audit/mysql-final/`保存最终MySQL/保护原始XML。最终LINE覆盖率 **82.95%**（7297/(7297+1500)），现有60%闸门通过。前端源码本轮未变，仍引用首轮90项与build通过证据，未宣称重跑。

`ReportMySqlClosureIT`按现有Surefire命名约定显式运行；没有为获得绿色结果添加排除/跳过配置，没有更改pom/CI，最终MySQL测试跳过0项。3项guard单元测试同时纳入默认全量套件。

上一阶段专项 39/39 在本轮最后完整 verify 中再次全部通过：ReportClosureIntegrationTest 15、ReportIntegrationTest 2、ReportServiceTest 15、AdminHallModerationIntegrationTest 4、AdminUserRestrictionIntegrationTest 3。首轮XML总结为 `backend/target/closure-audit/final-test-summary.json`；本次最终751项总结见 `mysql-final-verify-summary.json`。

首轮默认客户端verify完成jar打包、JaCoCo检查；当时汇总LINE覆盖 7261/(7261+1542) = **82.48%**，高于现有 60% 闸门。`backend/target/site/jacoco/` 为实际报告。指定 simple 命令仍失败，不能用另一命令的成功改写其结果。

### 可复现的隔离进程参数

仅修改一次性 PowerShell 子进程环境，finally 恢复；未改机器环境、pom、CI 或认证代码：

```powershell
$portraPreviousJavaOptions = $env:JAVA_TOOL_OPTIONS
try {
  $env:JAVA_TOOL_OPTIONS = '-Djdk.net.unixdomain.tmpdir=C:\Users\LiXiaozhou\.codex\worktrees\p0-report-entry-closure\Camera\backend\target\closure-audit\javatmp'
  mvn verify '-Dspring.http.client.factory=simple' # 实际仍失败 1+6
  # 本轮另一次完整对照运行：
  mvn verify # 实际通过 746，原有跳过 2
} finally {
  $env:JAVA_TOOL_OPTIONS = $portraPreviousJavaOptions
}
```

运行前创建该任务目录。目录较长，JDK PipeImpl 的 Unix-domain listener bind 回退到标准 TCP；并非关闭测试、反射修改 JDK 或禁用鉴权。此条件是本机的运行方案，不能声称默认环境已经修好。

### 55 个错误的根因与集合对照

逐用例比较 `target-baseline.log`、首轮 `target-final-verify.log` 和本轮 `target-closure-default-verify.log`，**三组错误方法名称完全相同，无新增/删除**；不只比较数量。结果与分类见 `backend/target/closure-audit/failure-comparison.json`。6 个直接 Pipe 错误（3 HTTP adapter + 3 首次上下文启动）、49 个共享上下文 failure-threshold 错误，无未分类项；依赖失败上下文内的最底层链均指向同一 NIO Pipe。

最底层：`java.net.SocketException: Invalid argument: connect`，发生在 `sun.nio.ch.UnixDomainSockets.connect0 → SocketChannelImpl.connect → PipeImpl$Initializer$LoopbackConnector`。上层是 selector 创建失败，导致 HttpServer/Java HttpClient 或 Tomcat 启动失败。不是普通业务调用到外部订单地址失败。

受影响类与数目：COrderHttpAdapterTest 3、AuthAndSessionIntegrationTest 12、B1B2RouteAuthIntegrationTest 5、DemandIntegrationTest 17、OrderFlowIntegrationTest 13、ServicePackageShowcaseContractTest 5。方法级名单保留在上一测试报告附录，且本轮 JSON 再次对照。

最小无 Spring Java 探针（`target/closure-audit/LoopbackProbe.java`）结果：localhost 解析 127.0.0.1 与 ::1；localhost/127.0.0.1 classic TCP 和 MySQL TCP 3306 均通过；::1 连接报 Permission denied；NIO Pipe 报上述 Unix-domain 异常。这推翻“所有 Java 回环 TCP 都不可用”的宽泛归因。IPv6 限制是另一项观察，未证实其导致这 55 个错误。

措施与结果：首轮 IPv4/PlainSocket 参数无效；本轮仅 java.io.tmpdir 无效；单独短 Unix-domain 临时目录也无效；本任务长目录触发标准 TCP fallback 后 Pipe 通过，原 55 错误消失。依据本机 JDK src.zip 的 PipeImpl/UnixDomainSocketsUtil 行为和探针确认。**具体 Windows AF_UNIX connect 被拒绝的系统机制仍未知**，未修改防火墙、系统网络或 JDK 安装。

### Socket 解阻后暴露的 7 项 simple 客户端失败

6 个 `java.net.ProtocolException: Invalid HTTP method: PATCH`：

- B1B2RouteAuthIntegrationTest.oldDemandRouteAllowsPublicGetButRequiresAuthenticatedCustomerForWrites
- B1B2RouteAuthIntegrationTest.oldServiceRouteAllowsPublicGetButRequiresAuthenticatedProviderForProviderWrites
- DemandIntegrationTest.getDemand_closedDemand_noAuthDoesNotUseDefaultCustomerAsOwner
- DemandIntegrationTest.myDemandHistory_returnsOwnOpenAndClosedDemandsExceptHidden
- ServicePackageShowcaseContractTest.photographerCanEditAndOfflineOwnPackageWithoutOrderOrPayment
- ServicePackageShowcaseContractTest.providerHistoryReturnsOwnOnlineAndOfflinePackagesExceptHidden

另 1 项：AuthAndSessionIntegrationTest.phoneAuthCors_allowsCredentialedLocalWebRequests，期望 allow-origin 为 http://localhost:5173，实际 null。

最小 `HttpClientProbe.java` 对照（`http-client-probe.log`）：Simple/HttpURLConnection 设置 Origin 后，服务器收到 null；setRequestMethod(PATCH) 抛 ProtocolException；默认 JDK HttpClient 的 PATCH 为 HTTP 200，服务器收到实际 Origin。完整默认客户端 verify 的这 7 项全部通过，且这些测试及后端代码与基准未变。它们是此前启动失败所遮蔽的客户端条件问题，不能仅凭原错误数量相同断言“已无其他失败”。

最小后续方案：正式验收使用支持 PATCH/Origin 的默认客户端，在隔离机器/现有 Java 17 Linux CI 重跑完整 verify 和指定命令对照；若必须使用 simple，应先由负责人批准专用测试客户端方案，不能改业务 API 为另一方法或删除 CORS 断言。本轮没有落地共享配置变更。本机 WSL Ubuntu 存在但未配置 Linux Java，未擅自安装/升级；可在隔离 CI/VM 配置 Java 17、Node 20、MySQL 8 测试库复现。

## 5. 真实 HTTP 联调（D1～D4）

实际前端：现有 Vite 页面，127.0.0.1:5188；仅进程 VITE_API_BASE_URL 指向 127.0.0.1:18088。后端：独立 Spring/Tomcat 进程，smoke profile，专属 `jdbc:h2:mem:portra_http_closure`；端口 18088，仅绑定本机。没有用 MockMvc 或模拟 HTTP 响应替代。

测试夹具 `backend/target/closure-audit/ClosureHttpRunner.java`：在独立库创建 owner/reporter/responder/admin、真实角色绑定和 AuthSessionService 会话。辅助端口 18089 仅作本机 fixture-cookie 导入/数据库只读观察/触发 HTTP 检查，不是交付接口，未加到生产 Controller。有效令牌、refresh 和随机管理员密码只保留内存，没有输出/写文件。只有短信传输用静默内存 SmsSender，验证码由原 PhoneSmsService 生成、原验证接口消费；没有替换 JWT/会话/举报/处罚服务，也没有发送真实 SMS。D3 初始登录态是测试夹具，解除限制后重新登录确实调用真实短信 HTTP 验证接口，短信运营商投递不属于本轮验证。

独立 H2 需要 MyBatis 表补充。最初没有加载 supplement，服务包详情 500；配置专属进程参数 `--spring.sql.init.mode=always --spring.sql.init.schema-locations=file:src/test/resources/schema-h2.sql` 后完整运行。该脚本是仓库原有 H2 测试资源，没有迁移 MySQL。夹具手机号归一化/编码器实例/收件箱键的初始错误也已修正；未完成轮次保留在 http-partial-evidence.json，下面仅使用最终完整轮次作为通过证据。

三页实际浏览器最终提交了：DEMAND #1 → report #1、SERVICE_PACKAGE #1 → report #2、USER #1 → report #3，均 HTTP 200 / code 200；真实成功 toast、焦点返回和数据库 PENDING 核对。管理员前端实际读取待处理列表及 #3 详情；处理后实际筛选“已处理”，显示 6 条 RESOLVED。处理调用与恢复由夹具使用真实 HttpClient 发往后端。

| 场景 | 实际请求和状态 | 数据库/业务结果 |
|---|---|---|
| D1 需求 | 浏览器 POST /reports；admin GET list/detail；合法非 owner PROVIDER POST /demands/1/responses code200；PATCH report resolve TAKE_DOWN code200；公开 GET detail code40401、合法响应 code40901；PATCH admin restore code200、公开 GET code200 | report #1 RESOLVED；需求恢复 VISIBLE，原业务 OPEN 保持 |
| D2 橱窗 | 浏览器 POST /reports；admin detail；非 owner CUSTOMER POST /service-packages/1/interest code200；TAKE_DOWN code200；公开 detail code40401、意向 code40901；admin restore code200、公开 GET code200 | report #2 RESOLVED；服务包恢复 VISIBLE，原业务 ONLINE 保持 |
| D3 用户 | 浏览器 POST /reports；旧 Access 先 GET /users/me code200；RESTRICT_USER code200；旧 Access 再 GET code40101；POST /auth/native/refresh code40101；admin status ACTIVE code200；POST /auth/sms/send、/auth/native/sms/verify code200；新 Access GET /users/me code200 | report #3 RESOLVED；限制时实际 DISABLED，最终 ACTIVE；恢复后经真实短信验证取得新 Access 并通过访问；未再以 HTTP 重测恢复后的旧 Access |
| D4 忽略 | 对上述三目标按既有规则再 POST /reports 得 #4/#5/#6，逐项 PATCH resolve IGNORE code200 | 各记录 RESOLVED/IGNORE；逐次比较原始业务、治理和账号状态，不发生变化 |

本后端业务错误也使用 HTTP 200 的 Result envelope，故必须同时记录业务 code：权限40101、隐藏40401、交互40901不能被写成“接口成功”。最终 **30 个真实 HTTP 检查全部与期望匹配**；浏览器 3 次创建另有 servlet filter 记录，仅写 method/path/httpStatus/businessCode/reportId，未写请求头或登录响应。日志 jsonl 后 3 项是 D4 夹具请求，应与最初 3 个浏览器请求区分。

证据：

- backend/target/closure-audit/frontend-report-evidence.jsonl（6 条创建；前 3 为浏览器）
- backend/target/closure-audit/http-evidence.json（30 个处理/恢复/认证/忽略 HTTP 检查）
- backend/target/closure-audit/http-final-state.json（6 条 RESOLVED、OPEN/ONLINE、VISIBLE/VISIBLE、ACTIVE、auditCount 12）
- backend/target/closure-audit/http-server.log（实际 Tomcat 18088 启动）

H2 的 12 条审计数量与 6 次举报处理、2 次内容处罚、2 次恢复、1 次账号限制、1 次账号恢复一致。本轮 HTTP 未扩展逐条审计字段或 HTTP 并发/故障注入；后者有原 H2 Spring 专项，但不替代 MySQL。辅助程序及临时服务在联调后停止；浏览器临时标签关闭，无真实账号处罚。

## 6. 真实MySQL契约与并发验收（2026-10-10）

本次使用已建立的独立 **MySQL Community 8.0.41** 实例，仅 `127.0.0.1:3307`，专属schema `portragovp0test`、账号 `portra_gov_test@127.0.0.1`。真实查询确认 `@@datadir` 为 `C:\Users\LiXiaozhou\.codex\test-environments\portra-mysql-3307\data`，隔离级别 **REPEATABLE-READ**，foreign_key_checks=1。原MySQL80/3306未连接业务数据库、未停止、未重置root密码或执行迁移。

先确认空库（0表），再按 `README_EXECUTION_ORDER.md` 的路径A顺序执行全部13个**原始**脚本，每个exit0，得到39张表；没有用Hibernate建表替代迁移，没有执行路径B、没有开启忽略SQL错误。`mysql-migration-results.json`记录顺序、SHA256及每份日志。真实SHOW CREATE TABLE/INFORMATION_SCHEMA证明reports、audit_records、demands、service_packages、users均为InnoDB；reports的`active_dedupe_key`为nullable VARCHAR(160)，`uk_reports_active_dedupe`为真实唯一索引。

测试通过DynamicPropertySource显式注入MySQL URL/driver/dialect、ddl-auto=none、sql.init.mode=never及关闭demo seed。既有ConversationSchemaInitializer/MomentSchemaInitializer会在Spring启动期校验/调整其表，不受上述DDL设置控制。因此在**注册任何datasource属性之前**用独立JDBC只读检查产品、schema、端口和datadir；每次fixture清理前再次确认身份与外键检查开启。3项guard回归验证错误datadir、H2均在注册属性前拒绝，正确实例先完成检查。没有修改这些共享初始化器。

真实业务调用经过原认证、Controller、Service、Repository和MySQL事务。继承15项闭环并新增14项严格验证，最终 **29/29通过，0失败/错误/跳过**。这里只用MockMvc作为Spring请求入口；它没有替代MySQL数据库，也不被宣称为独立HTTP服务联调。第5节独立HTTP结果仍对应H2服务器。

| 强制项 | 实际验证与结果 |
|---|---|
| 1.唯一约束 | 元数据证明唯一索引；绕过Service预查直接saveAndFlush重复记录，被真实MySQL1062/SQLState23000拒绝，原记录保留 |
| 2.并发去重 | DEMAND/SERVICE_PACKAGE/USER各两个事务，真实空dedupe预查后在CyclicBarrier汇合再插入；两次真实空检查、结果200/40902、仅1条PENDING；三组都实际触发1062，不能按串行预检查通过 |
| 3.处理后再举报 | 三类IGNORE释放key并保持对象状态；USER直接约束用例另验证2条已处理NULL key可共存，再建第3条PENDING；符合原目标可举报规则 |
| 4.两管理员竞争 | 三类分别用两个不同ADMIN及真实会话；保持首个事务在目标审计INSERT后未提交，观察到Innodb_row_lock_current_waits>0才放行；全部200/40901，仅1次目标处罚+1条REPORT审计，adminId均属于胜者 |
| 5.提交一致性 | 三类核对RESOLVED、resolution/admin/comment/reporter/target、key=NULL；目标HIDDEN或DISABLED，业务OPEN/ONLINE保持；目标及REPORT审计字段一致，时间存在且解决时间不早于创建 |
| 6.失败整体回滚 | 三类在最终REPORT审计故障点先EntityManager.flush，JDBC确认RESOLVED、目标处罚及1条内容/账号审计确实已写入；再抛异常，最终PENDING、原可见/ACTIVE、原key恢复、处理字段NULL、审计0 |
| 7.审计对账 | 三类成功处理逐条对账target_type/id、admin、action、reason、created_at；双管理员无多余处罚/审计，IGNORE不改对象；失败没有部分审计 |

证据相对backend/target/closure-audit：`mysql-final-summary.json`（三类CREATE_RACE/ADMIN_RACE/AUDIT/ROLLBACK结果）、`mysql-final-database-evidence.log`（真实版本/DDL/索引/最终状态/行锁指标）、`mysql-schema-contract.log`、`mysql-migration-results.json`及13份迁移日志、`mysql-final/`原始JUnit XML。最终数据库保留最后一例故障回滚后的测试数据，不把它误认为成功处理记录；各案例之间只清理本专属schema的测试fixture，保留真实约束、不DROP表。

仅仓库预查的时序及最后审计故障点使用spy协调，数据库查询通过原Spring Data代理委托执行，审计成功路径调用真实方法，没有模拟业务响应或提交成功。初次协调器调用接口callRealMethod失败的3项断言保留在日志；根据本机spring-test代理字节码改用框架原delegatesTo默认Answer后，全部严格断言通过，没有删除或屏蔽失败测试。

证据隐私检查覆盖最终及中间MySQL日志/原始XML，未发现本实例密码或JWT形式值；本机配置仍只允许当前用户和SYSTEM访问。真实MySQL测试完成后3307已正常关闭，数据及启动/关闭脚本保留；没有注册Windows服务或开启远程访问。

未覆盖：长期压力、生产部署和生产数据、MySQL上的独立前端HTTP服务再联调。后者不影响第5节已实际执行的H2独立HTTP证据，也不应被写成MySQL HTTP通过。此IT明确绑定本次受控实例身份，其他机器必须先调整和确认隔离契约，不能无参数回退连接业务库。

## 7. 风险分级与交付闸门

| 级别 | 具体证据 | 状态/处置 |
|---|---|---|
| P0 缺陷 | 本轮未发现已确认的新增权限绕过、重复处罚或事务破坏 | 有限代码审查 + H2/HTTP证据结论，不是全面安全审计 |
| 已解除的P0验收闸门 | 真实MySQL唯一键、三类强制竞争、不同管理员行锁、处罚后flush回滚及审计均实际通过 | 第6节29/29证据；不是发现或修复了P0生产漏洞 |
| P1 | 两项错误对象举报路由风险有真实失败回归 | 已修复新增入口并复审；原页面 stale 展示/操作问题另行处理，未擅改共享行为 |
| P1 验收条件 | 指定 simple verify 有1失败6错误；默认环境有55 Pipe错误 | 保留失败；隔离默认客户端verify通过不覆盖这些运行条件。共享配置方案须人工确认后另行实施 |
| P1/P2，测试夹具已修复 | 复审发现启动前隔离太晚及并发可能串行通过 | guard红3→绿3；三类空检查竞争/真实行锁等待已证明；未改生产代码 |
| P2 | report提示40101后保留表单，需要用户自行登录；未提供弹窗内自动登录流程 | 反馈真实，无权限绕过；不在本轮新增功能 |
| P2 | Vite build 实际大于500KB chunk警告；pom既有重复JaCoCo声明 | 未做无关重构；实际打包/覆盖率已通过 |
| P2 维护跟踪 | 首轮基线及最终 npm ci 均报告11项漏洞（2low/2moderate/7high），本轮锁对照现有包版本未变 | 不据总数推断可利用性；本轮未audit fix；由依赖负责人另行处置 |

## 8. 最终结论与停止状态

**BLOCKED**：MySQL强制验收闸门已经解除，真实HTTP功能和隔离默认客户端完整构建都有通过证据。但首轮指定`mvn verify -Dspring.http.client.factory=simple`仍记录1断言失败+6PATCH客户端错误，默认本机环境还需要NIO Pipe隔离参数。本次没有改变共享配置/CI/网络/认证，也没有重跑或宣布该指定命令已修复，因此不能按原指令标记PASS或批准正式合并。

- 新P0缺陷：未确认发现；原2项P1举报错误目标保护保持；本次2项测试夹具问题已修复。
- 完整测试：最终隔离默认客户端verify通过，751总数/749通过/2原跳过；前述指定simple失败条件仍未解除。
- HTTP联调：首轮真实前端+独立Tomcat/H2的D1～D4通过；本次MySQL调用使用Spring/MockMvc，明确区分。
- MySQL验证：29项真实业务验收全部通过，另3项启动前保护通过；七项契约已执行。
- 人工合并审核：可对最终16文件进行代码审查；正式合并前需负责人确认/解决指定构建命令与Windows运行条件，不自动改变共享配置。
- P0-E：本轮不启动，正式收口闸门尚未全部完成。

保持全部差异未提交、未暂存、未推送、未创建PR。独立3307测试实例已正常停止；原服务保持运行，数据和受限本机配置保留。本轮到此停止。

## 9. 后续补充：忘记原 root 密码后的隔离环境建立（2026-10-09）

用户表示忘记原 MySQL root 密码。没有重置密码、停止或改动原 MySQL80 服务，没有访问原业务数据库；复用本机安装的 MySQL 二进制建立了另一独立实例。第6节“没有可用隔离库/配置”描述的是首轮验收时的阻塞，当时仅解除环境前置条件；本次业务验收已按第6节完成。

- 专属实例：MySQL 8.0.41（真实 SELECT VERSION()），仅监听 127.0.0.1:3307。
- 建立时为空测试库portragovp0test、0表；本次已执行13个项目迁移得到39表，详见第6节。
- 测试账号：portra_gov_test@127.0.0.1，仅该专属库权限；USE mysql 返回1044，确认不能访问系统库。
- 新实例 root 空密码连接返回1045，首次启动已设置随机密码；一次性初始化密码脚本已删除。
- 数据和受限本机配置：C:\Users\LiXiaozhou\.codex\test-environments\portra-mysql-3307。client.ini包含测试连接信息，仅当前用户和SYSTEM可访问；不进入 Git、不在报告披露密码。
- 原服务 MySQL80 保持 Running；原3306端口与新3307端口同时运行。独立实例经过正常关闭、移出 Maven target目录、重新启动及真实连接验证，避免 mvn clean 删除测试数据。
- 未注册新的Windows服务；本机启动/正常关闭脚本及说明保存在上述独立目录。建立时实例运行；后续第6节真实验收完成后已正常关闭。
- 无新增交付源码、共享配置或CI变更。本补充仅更新本报告；当时14文件未暂存、未提交、未推送；本次补验后共16文件，状态仍相同。

该阶段只完成连接，不替代业务验收。随后第6节已补齐29项真实MySQL验证；整体仍BLOCKED，因为指定simple verify命令的既有失败没有改变。
## 10. 本次补验执行与人工交付清单（2026-10-10）

用户“那你执行吧”授权后，实际按迁移、真实MySQL测试、复审与一轮修复、最终全量verify、差异检查和报告顺序完成。新增的两份测试源码及原测试4个辅助方法可见性调整是本次唯一代码差异；后端生产代码/共享配置/依赖/CI未改。

可复现命令（先用本机环境start.ps1启动3307；凭据仅由指定本机文件读取）：

```powershell
$portraPreviousJavaOptions = $env:JAVA_TOOL_OPTIONS
try {
  $env:JAVA_TOOL_OPTIONS = '-Djdk.net.unixdomain.tmpdir=C:\Users\LiXiaozhou\.codex\worktrees\p0-report-entry-closure\Camera\backend\target\closure-audit\javatmp'
  mvn test '-Dtest=ReportMySqlClosureIT,ReportMySqlIsolationGuardTest' '-Dportra.mysql.clientConfig=C:\Users\LiXiaozhou\.codex\test-environments\portra-mysql-3307\client.ini'
  mvn verify
} finally {
  $env:JAVA_TOOL_OPTIONS = $portraPreviousJavaOptions
}
```

命令在本worktree/backend执行。MySQL29项独立执行结果与默认751项套件分开报告；guard3项在两次运行中均通过，不重复相加冒充更多覆盖。原有2项A2性能用例仍缺其冻结数据集而跳过，没有以本次治理库替代该业务验收。

复审指出的P1启动顺序问题已由3个观察到失败再通过的回归修复；P2并发证据不足已由真实双空查询与InnoDB等待断言补齐。一轮修复后32/32和完整751项均绿，没有再次改动生产行为。`mysql-progress.md`记录执行与决定，未据此提交或清理任何用户数据。

最终差异：5个已跟踪修改、11个新增文件、暂存0，HEAD及分支不变；16文件清单见第2节。只读对照原Camera目录仍为原3个修改和6个未跟踪项。需要人工决定的剩余事项仅为验收命令/运行环境与最终合并，不能将MySQL通过写成所有命令通过。

## 11. 用户授权提交合并与集成验证（2026-10-10）

用户在收到上述验收结论后明确指示“那你提交合并吧”，授权本任务提交、推送、创建PR并合并。第8～10节的未提交停止状态为该指令之前的历史记录；此后仅在现有举报任务worktree操作，不切换或清理原Camera目录的main及未提交修改。

合并目标为远端默认分支main。同步时origin/main为4e15da8c06232bc51cbdf87963774f96f16e4578，较基准新增需求响应原子性、报价确认幂等性、争议测试夹具及Harmony预约流程4个提交，与本任务16文件没有路径重叠。这些改动作为上游集成，不属于本轮擅自改动订单/需求业务。

仓库现有CI以Linux/Java17运行IntegrationTest及默认客户端clean verify，前端执行lint与build。合并以最新PR提交的现有CI通过为条件，不跳过检查、不改共享CI；main合并后现有流程会自动部署staging，用户已获告知。此前simple客户端命令与Windows Pipe的已知失败保留，第8节原强制验收结论不改为PASS。本轮不启动P0-E。

集成结果与远端PR/CI链接随实际执行更新；不得把计划执行记录为已通过。
