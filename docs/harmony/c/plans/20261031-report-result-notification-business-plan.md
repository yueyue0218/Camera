# 鸿蒙举报审核反馈与通知闭环实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 默认当前会话自行执行，最后一次独立审查，不为每个小步骤另开代理。

**Goal:** 复用现有举报、Web 审核和站内通知，实现举报人可查进度及结果、成立后的真实处置及目标方告知，并保护举报人身份。

**Architecture:** 后端审核事务是结论、处置和通知的真实来源；鸿蒙复用现有认证网络及通知列表，用 C 专用只读举报结果组件承接现有通知目标。不新增鸿蒙管理员页面，不重建举报表单，不由客户端轮询制造结果通知。

**Tech Stack:** HarmonyOS API26、ArkTS/ArkUI、现有 ApiService/HttpClient、Spring Boot/JPA、现有 ReportService/NotificationService、现有 Web 管理后台。

**Spec:** 本文件“业务规则”是用户于 2026-10-30 确认的规则及其当次文案澄清；工程选择和待维护者交付内容在下文明确标出。

**编写日：**2026-10-30，Asia/Shanghai。**拟执行日：**2026-10-31。今天仅写计划和交接；不实施业务、不运行新的业务验收、不推送或合并。本计划不创建自动执行任务，明天收到继续指示后启动。

## 2026-10-30 本轮提交与合入授权

用户现已明确要求将当前举报相关改动提交、推送并合入唯一集成分支integration/harmony-v1。本次将从该分支提取独立举报PR，避免夹带远端C分支其它未合入的订单/交付/个人页功能。以下“未推送/不合并”是此前归档时点，当前交付状态以本次集成记录为准。

合入不改变验收边界：原生真实举报与本人进度、自动化事务/隐私验证已通过；真实Web页面审核→双方鸿蒙通知、禁用账号告知可达性、实际MySQL迁移与历史数据清洗尚未完成。

## 执行状态（2026-10-30，用户指示提前启动）

本计划已执行，以下原“明天/今天仅文档”属于编写时点。已同步完整集成分支及C远端；本轮10文件已获对应维护者授权并正式应用。C结果/历史/入口和后端审核通知已实现，394/394、后端840通过/2原有跳过，最终HAP构建成功；本地原生真实report2与同ID进度已验。

用户随后暂停真实验证码，改本地开发验证码，并单独允许新隔离H2临时管理员：仅该本地夹具覆盖原“不得自行创建ADMIN”，没有扩大至真实环境。管理员和Web已启动；Windows工具因无法可靠识别Edge URL明确停止本轮，真实Web审核→原生双方通知仍未验收。任务6及受限告知/MySQL项保持未完成；未推送/合并。完整[执行证据和续接点](../evidence/20261030-report-results/README.md)。

工程修正：最新B表单没有onSubmitted，C读取原confirmed store的真实回执；H2 reports由JPA自动建表，未在schema-h2重复建表。独立审查追加修复公开治理原因和评价信用来源的既有隐私旁路，已红→绿及全套通过。

## 业务规则

| 阶段/结论 | 举报人看到什么 | 被举报者收到什么 | 后端实际动作 |
|---|---|---|---|
| 提交成功、待审核 | 真实举报编号、待核查、查看进度入口 | 不通知 | 保存 PENDING；不处罚、不扣分、不下架 |
| 审核成立且处置成功 | 处理结果通知，可进入同一举报结果 | 实际处置说明，不透露举报来源和身份 | 按管理员结论真实下架、隐藏评价或限制账号；记录审计 |
| 本次不成立/暂不处置 | 一句完整、自然的反馈，表达“已经收到并记录，后续重点关注” | **不通知** | 不执行处罚；记录审核和内部关注事实 |
| 处理失败或事务回滚 | 保留真实待处理/错误状态 | 不发成功处置通知 | 不留下虚假的已处理结论或成功通知 |

不成立的**建议文案**：“感谢你的反馈，你的举报我们已收到并记录，后续会重点关注相关情况。”这是一句建议，明天可保持原意润色；**不是把“已收到，要重点关注”几个字当作固定文案**。页面状态显示“已反馈”，处理时间表明本轮已反馈，不能把它显示为“举报成立”“已处罚”或继续显示成刚提交的待审核。

“重点关注”必须有后台可审计的记录或关注标记支撑；只改鸿蒙文案不能算这项业务已经实现。关注标记仅后台内部可见，不向对方、信用页或公开资料下发，不自动形成封禁、扣分或其他处罚。

成立通知按用户描述的业务顺序组织；实现时，实际处置成功和通知持久化须在同一可靠事务内提交，不能在处置尚未成功时先通知“已经处理”。通知先写入不代表已送达或已读，界面不得混用这些状态。

## Global Constraints

- 无论成立与否，禁止向被举报者或其他普通用户泄露举报人身份；仅本人可读自己的举报记录，后台合法审核权限另受原有最小权限控制。
- 不成立只反馈举报人，不通知被举报人；所有成立通知只能来自真实成功的处置。
- 不直接复用后台内部 `adminComment` 作为公开说明，不把举报原因原文、联系方式、昵称、头像、附件、审计备注复制给目标方。
- 沿用现有 Web 管理后台；没有鸿蒙管理员页面、管理员登录、管理 WebView 或新管理接口。
- C 使用独立工作区，唯一 PR base 为 `integration/harmony-v1`，不修改 main，不覆盖他人未提交代码，不重做已完成的动态、编辑删除、点赞收藏、举报可靠性及认证修复。
- 后端、公共 DTO/网络/导航及 B/D 页面须按原边界取得对应维护者明确授权；之前 ApiService 编辑删除和认证修复授权不自动覆盖本轮新文件。
- 不自行创建 ADMIN、不重置密码、不绕过验证码、不操作正式内容，不重复 resolve 真实联调中已处理的举报。
- 复用现有站内通知读取/已读机制；显露、恢复前台或用户刷新时读取，不承诺尚未实现的实时推送，不新增轮询。
- 新增公开说明与表单文案适配手机；新增可编辑说明最多 200 字。原举报表单继续复用，不能为本功能另写第二套表单或请求层。

## 已核实的代码与缺口

已合并的最近 C 交付为 PR #28，合并提交 `449173a`；C 分支交付提交为 `2b2ede0`。287 项回归是上一交付基线事实，不是本计划已经实现或已经通过的证据。明天必须重查远端，不能假设此后无人更新。

| 能力 | 现状与精确位置 |
|---|---|
| 举报提交/本人查询 | `POST /reports`、`GET /reports/my` 已有；`ReportService.java` 返回真实记录，后者仅本人数据 |
| 后台审核/实际处置 | `PATCH /admin/reports/{id}/resolve` 已有；ReportService 使用行锁、PENDING 检查及审计，调用现有内容/账号/评价处置服务 |
| 结果通知 | ReportService 及其处置调用链未接 NotificationService，没有举报结果事件产生 |
| 通知基础设施 | NotificationService 已有创建、去重、分页、未读和已读；NotificationResponse **会返回** actorUserId、sourceId、dedupeKey、metadataJson 等字段 |
| 举报结果模型 | 鸿蒙 ApiModels.ets 的 ReportSummary 缺少公开结论和说明；后端已有内部 resolution/adminComment，不能因此直接将内部备注公开 |
| 通知精确跳转 | NotificationTargetResolver 已识别 REPORT_*，但 NotificationPage.related/canOpen 的白名单没有 report；EngagementController.loadTarget 也拒绝 report |
| 可复用导航 | Index 已把普通目标转入 ORDER_ENGAGEMENT 并保留 targetKind/targetId，NavigationPolicy 无 report 白名单限制；优先在 C 页面分支承接，不改全局导航 |

## 工程方案与页面流程

采用现有通知入口和 `ORDER_ENGAGEMENT` 容器：`targetKind=report` 打开举报详情，`targetKind=reportList` 打开“我的举报”。这是本计划的工程选择，不是已存在的方法或路由功能。新增独立全局 AppRoute 会扩大公共改动；前端定时比较举报状态则无法代替后端通知，均不采用。

1. 举报成功仍由原 ReportPanel 提交；C 动态页捕获真实 ReportSummary，在本账号作用域内给“查看举报进度”入口。使用真实 reportId，不从对象 ID 推算举报编号。不要为这个入口改写 B 表单。
2. 通知页加入“我的举报”入口；即使通知已经读过，用户仍能查看本人历史及待核查记录。既有 `/reports/my` 是全量接口，不伪造服务器分页。
3. 举报人点击反馈通知后，以 reportId 精确进入结果页；页面再次从本人接口读取，不把通知摘要当成可授权读取的举报详情。
4. 结果页展示对象类型/编号、提交时间、待核查或已反馈/已处理、公开说明及处理时间。原举报说明可在本人页折叠查看；不显示内部审核备注或后台人员身份。原对象不可见时仍能查看自己的举报结果。
5. 被处置者在现有通知页读取“平台处理通知”和实际处置说明；首版复用通知展开详情，不强行跳入举报人结果页，不显示“查看举报”按钮。对象已下架或账号受限时，不能为打开原内容而放宽鉴权。
6. 所有新增页面沿用 Web 的暖色卡片风格；手机标题、正文、按钮分别留足空间，正文换行、长说明可滚动，顶部/底部安全区与 44vp 以上点击区域验证。复用已修复的页面显露、隐藏和应用前后台信号。

## 后端与公共维护者交付契约

### A. 审核、关注和通知

以下是维护者待交付建议，今天不修改这些文件：

- `backend/src/main/java/com/action/camera/report/service/ReportService.java`：保留 `resolve(Long, ReportResolveRequest)`，在原事务与行锁下完成结论、实际处置、公开反馈、通知和审计；重复处理仍拒绝。
- `report/service/ReportTargetValidator.java`：建议增加 `Long targetOwnerId(ReportTargetType type, Long targetId)`。处置前按 USER 本人、DEMAND.customerId、SERVICE_PACKAGE.providerId、MOMENT.authorId、REVIEW.reviewerId 读取实际目标方，不能把 targetId 一律当 userId。
- `report/domain/Report.java`、`report/dto/ReportResponse.java`：提供安全的公开反馈及真实内部关注状态。建议保存 `public_message`（最多200字）和 `follow_up_required`；如维护者已有等价真实关注机制，复用并返回完成事实，不建重复机制。
- 如需新增字段，由数据库维护者在 `backend/src/main/resources/db/migration/add_report_result_feedback.sql` 提供幂等迁移，并同步 `backend/src/test/resources/schema-h2.sql` 及项目现有 fresh-init schema；明天先查是否已有同类迁移，不自行执行共享库变更。
- 复用 `notification/service/NotificationService.createNotification(NotificationCreateRequest)`，无需另建通知网络层。NotificationService 的改动只在确有必要时由其维护者提供。

公开结果码建议：`PENDING`、`ACTION_TAKEN`、`FOLLOW_UP`、`LEGACY`。`IGNORE` 映射 FOLLOW_UP，且真实关注记录成功后才使用“后续重点关注”的反馈；TAKE_DOWN、REVIEW_HIDDEN、RESTRICT_USER 只有处置成功后映射 ACTION_TAKEN。既有 RESTORE 是恢复/纠正能力，不包装成“举报成立处罚”；历史 RESTORE 保留兼容、显示历史处理信息，不向历史记录补发本轮通知。

### B. 通知分开构造，防止元数据泄露

| 字段/行为 | 给举报人 | 给被处置者 |
|---|---|---|
| 事件 | REPORT_RESOLVED | MODERATION_RESULT，不能暗示举报来源 |
| 接收人 | 真实 reporterId | 真实目标所有者 |
| relatedType / relatedId | REPORT / 自己的 reportId | 原对象类型/原对象ID，不能是 REPORT/reportId |
| actorUserId | 系统事件优先 null | 必须不是举报人，优先 null |
| sourceType / sourceId | 可关联本人的举报 | 原对象类型/原对象ID，或已有安全处置标识，不带举报关联；保留现有 sourceId 默认回落到 relatedId 的兼容行为 |
| metadataJson | reportId、公开结论等最小字段 | 仅目标、实际动作、公开说明、时间；禁止 reporterId/reportId/举报正文/内部备注 |
| dedupeKey | 可使用本人的举报编号 | 使用不含举报编号/举报人身份的随机处置 UUID；该字段当前会下发客户端，不能放内部敏感关联 |
| 不成立时 | 恰好一条完整反馈 | 零通知，零处罚 |

目标方公开说明使用安全的处置模板和真实动作，例如“平台已完成审核，你的动态已被下架。”不能把举报人原文或管理员自由备注直接拼入通知。对方即使检查网络响应、metadata、跳转地址、错误页和去重标识，也不能获得举报人身份或举报记录入口。

限制账号存在可达性问题：若既有禁用策略会撤销登录，写入站内信不等于对方能立即读取。明天必须由后端/认证维护者确认合法的受限账号告知方式，复用已存在能力；C 不能临时放开通知接口或新增绕过认证的读取入口。未交付时，USER 限制告知单独标未验收，不能用内容下架的成功替代。

### C. 鸿蒙公共 DTO

`harmony/entry/src/main/ets/model/ApiModels.ets` 的 ReportSummary 建议只新增可选字段：

```ts
readonly resolution?: string;
readonly publicOutcome?: string;
readonly publicMessage?: string;
readonly followUpRecorded?: boolean;
```

保留现有 reportId/reporterId/targetType/targetId/status/createdAt/resolvedAt；不要求 C 渲染 adminComment。后端 ReportResponse 对应新增字段，并保持既有消费者兼容。旧数据缺少新字段时显示“历史处理信息”或同步提示，不捏造成立/重点关注，不按空值判定处罚。

## Review Focus

1. 对方通过 NotificationResponse 的 metadata/source/actor/dedupeKey 推断举报人：任务1、2的完整序列化隐私测试覆盖。
2. 不成立被当成处罚、或只改文案却没有关注事实：任务1、3的零处置/零目标通知/真实关注状态测试覆盖。
3. 账号切换、对象切换、后台恢复后旧成功/异常/finally 覆盖新结果：任务3、4的版本和实例行为测试覆盖。
4. 单看 resolver 就误称可跳转，实际页面白名单或订单加载仍拒绝：任务4、5做“通知→同reportId”的页面接线和设备验收。
5. 重复审核、事务失败、账号禁用导致假通知或不可达：任务1、5、6验证幂等/回滚，受限告知未交付就明确不通过。

## 分步执行与验收计划

### 任务0：明天恢复工作与授权核对

- [ ] 读取最新 AGENTS.md（如存在）、本计划、C 三份交付文档和 C-SHARED-12。检查工作区/远端/PR，保留今天未提交的计划文档，不覆盖主工作区他人修改。
- [ ] 核对后端/公共维护者是否已有修复 PR，优先复用，记录真实提交。准备可审阅候选后再确认本轮边界授权；本计划及过去别的授权不等于后端/DTO 授权。
- [ ] 核查后端、合法 Web 管理员访问方式、SDK、模拟器和端口映射。地址分别标“配置发现/实际连通/团队确认”；既有 `127.0.0.1:18090` 是本地隔离 H2，不是团队 staging。
- [ ] 记录工作基线、实际命令及明天发现的新差异。默认当前会话直接实施、最后一次独立审查，控制额度；今天不启动这些任务。

### 任务1：维护者完成审核事务与两类通知

**文件：**后端契约 A/B 所列文件；现有 `backend/src/test/java/com/action/camera/report/ReportServiceTest.java`、`integration/ReportClosureIntegrationTest.java`；新增 `report/ReportNotificationPrivacyTest.java`。

**接口产出：**真实公开结果字段、REPORT_RESOLVED、MODERATION_RESULT、关注完成事实和原子事务。

- [ ] 先写失败用例：成立处置成功后 reporter=1条、target=1条；IGNORE 时 reporter=1条完整反馈、target=0条、处置调用=0、关注记录=true；处置或通知写入失败时结论/处置/通知均不出现假成功。
- [ ] 加入隐私用例：目标通知 JSON 只含允许字段，actor 不是举报人、source 不关联举报、dedupe 为不透明标识，标题/正文无测试举报人姓名/手机号/唯一原文标记。
- [ ] 在自动化隔离用例验证已处理/并发处理不重复通知；真实设备联调每个举报只 resolve 一次，不拿既有已处理举报反复调用。
- [ ] 目标命令：mvn -f backend/pom.xml "-Dtest=ReportServiceTest,ReportClosureIntegrationTest,ReportNotificationPrivacyTest" test。先观察预期失败，再完成最小维护者补丁，跑目标测试和后端现有全套；记录命令、退出码、迁移验证和提交。

### 任务2：公共 DTO 与通知兼容契约

**文件：**ApiModels.ets（维护者授权后）；C 测试 `harmony/tests/report-result-api.test.cjs`、`notification-target.test.cjs`。

- [ ] 先写真实 ApiService+HttpClient 行为测试：本人 `GET /reports/my`、Bearer、实例key；旧DTO缺字段；新FOLLOW_UP/ACTION_TAKEN；非法/矛盾reportId；跨实例取消不串扰。
- [ ] 应用维护者已交付的可选 DTO 扩展；复用既有 listMyReports/currentSession/cancelReports，不导入尚未提供的方法。
- [ ] 目标方通知只读展开，不被解析为举报结果；举报人的 reportId 只来自有效 REPORT_RESOLVED、relatedId 和 metadata 一致的契约。未知事件不猜 ID 或读取管理员 API。
- [ ] 跑对应测试达到全绿，并记录公共提交/PR。

### 任务3：C 专用本人举报读取和结果状态

**新增文件：**`features/report/ReportResultController.ets`、`ReportResultApiBinding.ets`、`ReportResultModels.ets`（路径均相对 `harmony/entry/src/main/ets/`）。
**测试：**新增 `harmony/tests/report-result-behavior.test.cjs`。

**接口：**`resume():void`、`suspend():void`、`load(reportId:number=0):Promise<void>`；0 为本人列表模式，正安全整数为精确结果模式。C port 只消费 currentSession、listMyReports 和实例取消。绑定取消读取时可调用 `cancelReports(key+'.unused-create', key)`，两参数必须都是本组件独有 key，不省略成默认全局 key。

- [x] 先写失败用例：本人精确ID；错误reporterId拒绝；非法ID不请求；PENDING/FOLLOW_UP/ACTION_TAKEN/历史缺字段；同一加载合一；切对象/身份/隐藏后旧success/catch/finally无效。
- [x] 实现先核对会话再读本人记录，列表模式只接受当前reporterId数据；结果不存在或被篡改显示无权/不存在，不降级展示通知摘要或别人的记录。
- [x] 建立独立loading/error/empty/result状态；使用实例key及会话/对象/视图版本。显露或前台恢复重新核对；不轮询，不把历史已处理记录补造成新未读通知。
- [x] 补 FOLLOW_UP 但 followUpRecorded 非 true 的异常契约用例：不虚构已建立关注事实，显示结果同步/核对提示。运行上述用例及现有 notification-credit-behavior 测试，全绿后提交该可独立验证单元。

### 任务4：举报进度页、本人列表和精确通知入口

**新增文件：**`features/report/ReportResultView.ets`。
**修改C文件：**`pages/OrderEngagementPage.ets`、`pages/NotificationPage.ets`、`features/notifications/NotificationController.ets`、`NotificationTargetResolver.ets`、`pages/MomentFeedPage.ets`。
**测试：**新增 `report-result-routing.test.cjs`；扩展 notification-target、notification-credit-behavior 现有回归。

- [ ] 先写页面接线回归：REPORT_RESOLVED 可见相关结果按钮并传同reportId；report 分支不调 getOrder/getReview 等接口；reportList 的0不被当订单id；其它订单/评价/申诉入口保持原行为。
- [ ] NotificationPage 的 related/canOpen 都加入 report，不能只改 resolver。增加“我的举报”；有举报分类时采用可滚动/换行筛选，不把手机标签挤在一行。
- [ ] OrderEngagementPage 在 report/reportList 分支挂 C 结果组件，跳过订单控制器初始化/加载/监听；结果组件独立订阅真实显隐与前后台事件，避免双请求。不改全局路由或页面注册。
- [ ] MomentFeedPage 在原 onSubmitted 回调捕获已确认真实reportId，给“查看举报进度”；账号变化清旧回执。B ReportPanel 与表单不复制、不直接改。
- [ ] 完成手机暖色结果卡片、原说明折叠、空/错/旧数据处理。界面不出现管理员操作，不提供不存在的通用处罚申诉按钮。
- [ ] 跑接线、身份隔离及原 engagement/moments 回归，全绿后提交。

### 任务5：被处置者告知与全链路隐私验收

**文件：**复用 C NotificationPage/NotificationController，必要时仅添加小型纯呈现组件，不新建举报读取接口。

- [ ] 先写行为测试：MODERATION_RESULT 可读真实公开说明并正常已读；无“查看举报”入口，不调 reports/my；不成立时目标列表新增该类通知=0。
- [ ] 对目标方完整 HTTP JSON 做字段白名单检查；UI隐藏不是网络隐私修复，后端仍下发身份信息则禁止通过。
- [ ] 核查受限账号能否通过已有合法机制了解处理结果。不得因通知无法读取而放松账号限制；缺依赖则单独记录，内容处置可先验，但不能宣称账号限制通知也已完成。
- [ ] 保留原有通知未读计数、已读并发及失败结果核实机制，跑相关回归后提交。

### 任务6：真实鸿蒙→Web审核→通知→结果/处置验收

仅使用合法测试环境、普通测试对象及已有合法管理员权限。每种结论新建独立report；不重复处理旧举报，不以Node手动调用生命周期代替设备证据。

- [ ] 成立：模拟器普通用户真实提交→记录同reportId→Web合法账号审核并处置→举报人真实刷新/重进通知→点同ID结果→目标方独立登录读公开处置通知→内容刷新/重进反映真实可见性。作者可读下架内容和他人不可见等后端差异按实际记录。
- [ ] 不成立：新举报经IGNORE处理→举报人收到完整“收到记录、后续重点关注”反馈并可查处理时间→后台关注事实可核对→目标方通知增量0，内容/账号/信用无处罚变化。
- [ ] 设备交互：通知→结果→返回、退出再登录、切账号、后台恢复、弱网和结果读取失败、重复点击；旧账号内容不重现，不抢用户正在手动体验的模拟器。
- [ ] 保护检查：用目标方会话访问举报人结果仍无权；检查通知JSON、跳转参数、错误提示、日志及dedupe字段，不包含举报人标识或原文。
- [ ] 团队环境不可用时可用已获授权的隔离本地后端/H2，但需实际合法管理员访问；不自行预置ADMIN。证据明确写“本地”，团队跨端项继续标未验证。

### 任务7：全套、构建、审查和交付

- [ ] SDK环境变量配置正确后执行现有全套，不删失败/skip：

```powershell
$env:DEVECO_SDK_HOME = 'C:\Program Files\Huawei\DevEco Studio\sdk'
$cTests = @(Get-ChildItem harmony/tests -Filter '*.test.cjs' | ForEach-Object FullName)
& 'C:\Program Files\Huawei\DevEco Studio\tools\node\node.exe' --test @cTests
```

- [ ] 后端维护者跑目标用例及 `mvn -f backend/pom.xml test`；需要数据库/环境的用例按实际记录，测试框架受控管理员上下文不当作真实管理员联调。
- [ ] 在 harmony 目录，以明确dev/local或团队确认staging变量运行 `hvigorw.bat assembleHap --no-daemon -p product=dev`（staging用对应product）；记录实际完整命令、环境、退出码及HAP SHA。unsigned/dev不能叫签名联调包。

本地隔离构建命令示例（在 harmony 目录；明天先确认该本地地址确实可用）：

```powershell
$env:NODE_HOME = 'C:\Program Files\Huawei\DevEco Studio\tools\node'
$env:DEVECO_SDK_HOME = 'C:\Program Files\Huawei\DevEco Studio\sdk'
$env:PORTRA_ENVIRONMENT = 'dev'
$env:PORTRA_BASE_URL = 'http://127.0.0.1:18090'
& 'C:\Program Files\Huawei\DevEco Studio\tools\hvigor\bin\hvigorw.bat' assembleHap --no-daemon -p product=dev
```

团队 staging 必须使用团队确认的 HTTPS origin，同时把环境变量和 product 都改为 staging，不能把上例 dev/local 包称作团队联调包。
- [ ] 一次独立只读审查重点看隐私、受众、结论映射和身份竞态；重要问题补红→绿回归再修，不扩大无关页面重构。
- [ ] 更新 `c-module-delivery.md`、`c-ui-audit.md`、`shared-change-requests.md`；新增日期证据目录，保存文件清单、公共/后端PR、真实reportId/notificationId及处置结果、命令退出码、截图和安全脱敏JSON。不得提交token、验证码或管理员凭据。
- [ ] 明天重新确认交付指示：只按授权提交/推送；合并必须针对本轮已验证精确head和唯一base，不能把旧任务的合并指令当成所有未来改动的自动合并授权。

## 完成定义与缺依赖时的推进

完成须同时满足：两个审核结论受众正确；关注事实真实；成立实际处置；举报人精确查看本人结果；目标通知所有可见字段无身份泄露；通知读取/已读及账号隔离正确；相关测试、全套、HAP和真实模拟器/跨端证据按环境如实通过。

维护者尚未交付时：核对最新代码→补 C-SHARED-12 精确交接/候选补丁→继续 C 自有模型、状态、纯呈现与回归，不导入不存在的方法、不写另一个网络层、不在正式页面放假通知。后端处置、真实关注、公开DTO或合法管理员任一关键项未具备，就分别记为待维护者/未验证；不能仅凭页面可打开宣布举报业务闭环完成。

## 计划自检（仅文档核对，非实现完成）

- 用户文案澄清已纳入：完整自然语句，不是固定短标签。
- 已覆盖提交、待处理、成立、不成立、处置失败、历史记录、隐私和受限账号可达性。
- 已明确通知页白名单、目标解析与实际页面分支三处接线，未把resolver能力当成页面已可用。
- 新接口均标明现有/建议，字段与方法在任务之间一致；公开DTO及后端修改保留维护者边界。
- 所有实现复选框保持未勾选；今天没有执行其中任务，没有新通过率或新验收结论。
