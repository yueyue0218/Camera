# 2026-10-30 举报审核反馈与通知：实现及验收记录

## 2026-10-30 本轮提交与合入授权

用户现已明确要求将当前举报相关改动提交、推送并合入唯一集成分支integration/harmony-v1。本次将从该分支提取独立举报PR，避免夹带远端C分支其它未合入的订单/交付/个人页功能。以下“未推送/不合并”是此前归档时点，当前交付状态以本次集成记录为准。

合入不改变验收边界：原生真实举报与本人进度、自动化事务/隐私验证已通过；真实Web页面审核→双方鸿蒙通知、禁用账号告知可达性、实际MySQL迁移与历史数据清洗尚未完成。

## 当前结论

业务代码已按本轮后端/数据库/公共DTO维护者10文件授权正式应用。C本人历史、精确进度、通知跳转、平台处置通知只读、安全结果投影、实例/身份保护已实现。后端真实处置、公开结论、关注标记、双方分开通知、事务回滚及隐私修复已通过自动化验证。

**尚未完成真实Web审核→双方原生通知闭环、MySQL迁移和受限账号告知可达性。** 本轮没有推送、合并、部署或改共享数据库。不能称完整举报业务验收完成。

## 基线与边界

C独立工作区 `C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera`，feature/harmony-c-ui-polish。fetch后远端C=170035a、完整integration/harmony-v1=449173a；快进C后将完整集成分支合入，形成6d053183d38858175957830f3c7775830b81da41。验证integration为HEAD祖先exit0。main与其它工作区未修改；原计划文档保留。没有找到仓库AGENTS，适用 `.codex/AGENTS.md` 为空。没有可复用的新增举报通知PR。

[实际修改清单](changed-files.txt)、[维护者10文件](../../proposals/report-result-notifications/owner-files.txt)、[最终后端补丁](../../proposals/report-result-notifications/owner-backend.patch)、[公共DTO补丁](../../proposals/report-result-notifications/owner-dto.patch)。不改认证/网络/全局导航/共享主题/B表单/A/B/D业务页/Web页面。保留旧Feed、互动、相册、编辑删除及既有生命周期成果。

## 行为与重要工程决定

- IGNORE：存RESOLVED、公开完整自然反馈及真实follow_up_required=true，只给举报人REPORT_RESOLVED；目标零通知零处罚。示例完整反馈：“感谢你的反馈，你的举报我们已收到并记录，后续会重点关注相关情况。”
- 成立：在原事务和行锁内先真实处置，再保存公开结果、审计和两类通知。处置或通知失败全部回滚；重复/并发处理仍受原状态保护。目标收MODERATION_RESULT，actor=null、对象真实所有者，source/target/related均为原对象，去重为不透明随机UUID，metadata只含action/targetType/targetId。
- 本人报告响应不暴露adminId/adminComment。C只投影白名单字段；缺新反馈显示历史信息，FOLLOW_UP没有真实关注事实显示待核对，不编造成立或关注。RESTORE保留历史/纠正语义。
- 独立只读审查发现既有内部审核备注会经作者ModerationView公开，已修为安全处置模板；自查同时修复评价信用回滚的REPORT/reportId来源为MODERATION_REVIEW/reviewId。内部备注仍留合法后台报告和审计。新增2项单元用例观察红→绿，并有作者详情HTTP回归。**历史库旧原因/信用来源未擅自清洗，需维护者单独审计。**
- ReportPanel实际上没有计划假设的onSubmitted。C进度按钮只读原有confirmed store，验证当前版本/账号/目标的真实reportId；没有已确认记录则进本人列表，不猜momentId。不新增回调、不改B表单、不轮询。
- ORDER_ENGAGEMENT中report/reportList分支独立承接，跳过订单controller初始化/监听/请求。C用已有currentSession/listMyReports/cancelReports，两个取消key均本实例独有；旧success/catch/finally不能覆盖新账号或新目标。

## 自动化与构建：实际命令和退出码

PowerShell；C仓库目录，SDK=`C:/Program Files/Huawei/DevEco Studio/sdk`。

```powershell
$env:DEVECO_SDK_HOME='C:\Program Files\Huawei\DevEco Studio\sdk'
$cTests=@(Get-ChildItem harmony/tests -Filter '*.test.cjs'|ForEach-Object FullName)
& 'C:\Program Files\Huawei\DevEco Studio\tools\node\node.exe' --test @cTests
```

拉取后基线375/375；最终**394/394，fail/cancelled/skip/TODO均0，exit0**。[完整最终日志](harmony-tests.txt)。新控制器与路由先失败后通过，真实HttpClient测试覆盖Bearer、GET /reports/my和跨实例取消不影响另一个举报提交。测试夹具首次漏message导致parse失败，修正夹具，未改传输实现。

```powershell
$env:JAVA_HOME='C:\Program Files\Java\jdk-17'
$env:JAVA_TOOL_OPTIONS='-Djava.io.tmpdir=C:\Users\LiXiaozhou\Camera\.tmp\c-jvm-tmp -Djdk.net.unixdomain.tmpdir=C:\Users\LiXiaozhou\Camera\.tmp\c-jvm-tmp'
mvn -f backend/pom.xml test
```

最终正式源码**842项，840通过、0失败、0错误、2原有跳过，exit0，3分42秒**。[逐类摘要](backend-full-summary.txt)。原有跳过为ServicePackageA2MySqlSmokeTest的recommendationUsesFixedSevenSqlStatementsForAllFrozenCandidates及sameA1RequestUsesFixedEightSqlStatementsAgainstFrozenMySqlDataset。没有删测试或新增skip。本机未找到docker，未执行真实MySQL迁移。

目标命令 `mvn -f <candidate>/backend/pom.xml "-Dtest=ReportServiceTest,ReportClosureIntegrationTest,ReportNotificationPrivacyTest" test`：最终52/52，exit0。[摘要](privacy-green-summary.txt)。初始新增隐私集19项中4项预期失败；修复后绿。独立审查2项隐私复现先失败，再修复；[红](privacy-red-summary.txt)。整套首次225项Windows JDK loopback Invalid argument错误，根因用本进程短临时目录解决；修复前正式839项0fail/0error/2skip，最终新隐私用例加入后842项如上。未改系统JDK/共享配置。

在harmony目录：

```powershell
$env:NODE_HOME='C:\Program Files\Huawei\DevEco Studio\tools\node'
$env:DEVECO_SDK_HOME='C:\Program Files\Huawei\DevEco Studio\sdk'
$env:PORTRA_ENVIRONMENT='dev'
$env:PORTRA_BASE_URL='http://127.0.0.1:18090'
& 'C:\Program Files\Huawei\DevEco Studio\tools\hvigor\bin\hvigorw.bat' assembleHap --no-daemon -p product=dev
```

最终exit0，40.446秒，SHA256 **E533E7BC2DF54F68DF8C2DF005E3C7205A57E445B7F67B13E3715F3E277E1B5B**；[日志](assemble-dev.txt)。staging同命令改environment/product=staging、BASE_URL=https://47.76.106.57，exit0/32.564秒，[日志](assemble-staging.txt)。包均unsigned/debug，不能称发布签名或团队验收包。保留SDK既有warning，不用warning冒充构建失败。

## 模拟器实际证据（阶段1）

Mate90Pro/API26，HarmonyOS7.0.0.107，1280×2832，hdc127.0.0.1:5555。正常hdc install -r/aa start及rport18090均exit0。新集成隐私页由用户亲自同意，登录协议也由用户亲自处理；随后使用随机开发验证码正常原生登录普通用户1，未注入token。

数据库 `portra_c_report_result_20261030`，smoke/H2内存、仅回环，**当时未创建ADMIN**；普通举报人1双角色、作者2。阶段1已结束，不能把后来重启的新库当作它。

1. 普通HTTP准备动态1/2、本人report1 PENDING；另一账号GET /reports/my为空。[对象](local-objects.json)、[环境](local-metadata.json)。
2. 真实大厅铃铛→正常登录返回通知→“我的举报”看到report1待核查。展开本人说明，真实Home→aa start恢复，重新读取并收起旧展开；[前台布局](native-report-foreground.md)。[通知图](notifications.png)、[本人列表](report-list.png)。
3. 真实动态2→原有举报表单→原因“其他违规行为”、测试标记C-report-native-20261030→提交成功。服务端确认**reportId2/targetId2/PENDING**；[原生提交](native-report-submitted.md)、[服务端读回](native-report-server-confirmation.json)。
4. 真实“查看举报进度”→**同reportId2的独立进度页**，未误进report1或订单；[布局](native-report-exact2.md)、[原始截图](report-exact2.png)。

工具过程如实记录：动态测试最初复用大素材，Feed响应11,502,721字节，原生出现网络错误；只通过真实PUT把本轮测试对象换为现有小素材，160,529字节后恢复。未改公共网络限制；大响应行为单列后续依赖，不据此声称通用大图能力已修复。模拟器按控件编号点击发生错位导航，未记通过；重新观察后用原生HDC当前坐标验证上述精确落点成功。snapshot_display未生成可接收文件，改用原生模拟器截图并验证完整PNG后归档，无修图。

## 环境来源与真实服务器检查

| 地址 | 来源/配置发现 | 本轮实际连通 | 已确认范围 |
|---|---|---|---|
| https://47.76.106.57 | harmony/README.md临时staging、ApiService正常短信路径 | 正常TLS根页与/login/admin均HTTP200；鉴权API返回真实40101 | 用户仅授权一次连接/短信测试；不是普通内容/审核全量团队验收确认 |
| 同源/auth/sms/send | ApiService.sendLoginCode契约，POST phone/purpose/deviceId | 一次请求HTTP200、业务40901“临时测试环境不提供真实短信登录，请使用测试账号入口” | **未发送成功**，无真实验证码；用户随后明确暂停真实验证码，不自动重试 |
| http://127.0.0.1:18090 | 阶段1普通fixture、阶段2授权管理员fixture | 监听回环、阶段1正常原生登录/举报/读回均真实 | 本地隔离验收，不是团队staging |
| http://127.0.0.1:15173/login/admin | 仓库现有Web路由，Vite进程仅回环，VITE_API_BASE_URL=18090 | Vite成功启动，后台尚未正常登录/审核 | 本地；Windows浏览器工具停止，见下一段 |

[脱敏短信回执](staging-sms-result.json)不含完整手机号。没有读取真实服务端密钥、绕过短信/验证码或修改真实服务器配置。

## 阶段2：用户单独授权本地管理员，尚未执行Web审核

用户明确允许“仅在本轮隔离本地H2创建临时管理员并验收”。已保留阶段1证据并核实PID后停止专用阶段1进程；没有停止其它服务。新库 `portra_c_report_web_20261030`，实际是 `.tmp/c-report-result-web-20261030/db/report_web` 的独立H2文件库；仅127.0.0.1:18090，JPA update，原生base不变。创建普通用户1和**全新专用管理员2**，随机密码/BCrypt，仅本地角色绑定；不修改既有账号或真实环境。[无凭据元数据](phase2-web-local-metadata.json)。服务PID22156；Vite15173已运行。

凭据仅在本机忽略目录 `C:/Users/LiXiaozhou/Camera/.tmp/c-report-result-web-20261030/admin-credentials.private.json`；没有输出或提交密码/token。未调用管理登录或resolve，当前没有经审核的本轮举报；阶段1App会话需在新库重新正常登录，不能继续当作旧库。

**本轮Windows工具停止原因原文：**“Computer Use has been stopped for this turn because it could not determine the current browser URL on Windows with enough confidence to enforce policy. Stop your work and send a final message noting why Computer Use ended.”

因此不继续输入、不换浏览器通道绕过限制。仅完成不涉及应用输入的证据归档。下一轮可由用户先在Edge打开上表本地后台，再恢复工具选择；合法账号和本地环境已准备。不能把测试框架管理员上下文或HTTP自动化绿灯冒充真实Web审核证据。

## 剩余事项

- 阶段2正常Web管理员登录→两个新举报分别成立/IGNORE各审核一次→举报人精确结果通知、作者公开处置通知、不成立目标通知增量0、真实下架/合法恢复/鸿蒙重读。禁止重复处理阶段1或已处理报告。
- 受限账号通知虽然同事务写入，但现有鉴权拒绝禁用者读取，合法受限告知机制仍待维护者；不放宽认证。
- 实际MySQL迁移与部署仍未验证；团队真实服务器/SMS用户已暂停，实体设备按用户要求不列本轮条件。
- 维护者审计历史旧治理原因/信用来源；确认Feed大响应传输/缩略图能力，未经新授权不直接改公共网络或图像策略。
- 本轮不推送、不合并。工作区修改和完整计划、证据均保留，继续时不要重做已完成的代码/回归。

## 后续检查补充（同日）

正常本地POST /admin/login已用同一临时账号返回code200、role=ADMIN、adminCapable=true；CORS预检通过，Vite实际注入API=http://127.0.0.1:18090。浏览器页面仍报告账号或密码错误，原因未确认；接口验证不代替Web页面登录/审核。没有重置密码、复制Token到浏览器或绕过认证。

真实staging短信再次按用户请求发送一次，返回code200/success，[脱敏回执](staging-sms-recheck-result.json)。这只证明正常接口受理，实际手机收信未获确认；此前40901拒绝保留历史，不能继续作为当前接口必然拒绝的结论。
