# C 公共依赖与交接

核查基线：`b258ec8114ac1ff8f360099155f5d284f1247c41`。日期：2026-10-25。
以下均为交接需求，未替维护者实现；没有擅自修改公共或 B 文件。

| ID / 优先级 | 当前缺口、目标文件 / 维护者 | 建议契约 / 生命周期 | 调用方、验收 / 状态 |
| --- | --- | --- | --- |
| C-SHARED-01 / P1 | network/ApiService.ets 缺少点赞方法；后端 MomentController 已有 PUT/DELETE。公共网络维护者/协调人 | `likeMoment(momentId: number): Promise<MomentSummary>`、`unlikeMoment(...)`；PUT/DELETE `/moments/{id}/like`，正安全整数校验，沿用认证和统一错误；按对象/实例隔离 key 并提供取消；禁止 toggle 自动重放 | MomentFeedPage；以返回 ID/布尔值/计数为准，离页/身份变化丢弃结果。**阻塞**：尚无维护者提交，页面维持真实点赞计数只读 |
| C-SHARED-02 / P1 | network/ApiService.ets 缺少详情，后端 GET `/moments/{id}` 已有；公共网络维护者/协调人 | `getMoment(momentId: number, requestKey?: string): Promise<MomentSummary>`，匹配 ID 校验；`cancelMomentDetail(requestKey?: string)`；隔离在途实例与旧结果 | C 详情/完整多图预览；每次重进重新校验可见性，不能把 Feed 三张预览当完整图片。**阻塞**：尚无适配，未创建假详情入口 |
| C-SHARED-03 / P1 | features/user/ReportPanel.ets 属 B，未移交；只校验 status 非空，缺目标/会话/离页版本保护；取消后仍可能处理旧提交。B/协调人 | 状态仅接受 PENDING/RESOLVED；提交前捕获 targetType/targetId/sessionVersion/generation，响应/异常/finally 均检查；目标变化重置 submitted/error 与输入策略；超时/取消提示结果待确认并用现有 listMyReports 核实，不能盲重发。确认后由 B 修复或明确移交 | C 目前仅复用；选中对象切换时销毁旧实例，展示动态 ID/标题；同页最多一个表单。真实提交闭环仍**阻塞**于表单生命周期和设备/后端验证，不宣称组件已全面完善 |
| C-SHARED-04 / P1 | ApiService.createReport/listMyReports/cancelReports 固定 reports.create/reports.my；ReportPanel.aboutToDisappear 调 cancelReports。A 详情页、C Feed 可在导航栈同时存在，离开任一实例会取消另一个的提交；HttpClient 同 key 替换也会使旧请求失效。公共维护者 + B | createReport/listMyReports 增加可选 requestKey（保留现有默认参数兼容），取消方法接收同一 key；ReportPanel 为每个实例/对象持有唯一 key，只取消自己；取消不代表服务端未写入，需核实记录 | 关闭 Feed 举报不应取消 A/B 举报；导航覆盖下层页面与快速换目标回归。**待整合**：基于现有调用链与 HttpClient 同 key 策略确认，C 未改底座 |
| C-SHARED-05 / P2 | MomentSummary 无真实作者昵称/头像；公开用户资料 API 已有，公共主页导航入口未给 C；B/协调人 | 复用 B 的真实资料/公开主页回调契约，明确 role、userId 和会话失效；不新增假资料或第二套主页 | MomentCard 当前显示真实角色 + ID、确定性 Avatar 回退。**待对齐**：不阻塞只读卡片 |
| C-SHARED-06 / P2 | B ProfilePage 当前 listFavoriteMoments 在进入/切换时真实读取，C MomentCard 也被其只读复用；尚无设备联验。B | 维持真实重新读取；若引入个人缓存，由 B 定义失效契约。C 收藏成功清空所有 C scope 缓存后只写当前 scope；失败/在途离页清空 C 缓存 | 保留 item 参数；新增属性有默认值、回调可选，ProfilePage 无需改动。**代码兼容/逻辑回归已验证，设备联动未验证** |
| C-SHARED-07 / P1 | 原 Index/Shell 无显露或恢复信号，fetch 后仍无维护者更新。C 已新增 features/moments/MomentFeedLifecycle.ets，局部订阅原生 Navigation 切换、目标shown/hidden与ApplicationContext前后台；不修改公共入口 | 页面重新查询自身 Navigation/NavDestination，根路径按空栈、HALL 按自身 index/state/id 判定；navDestinationUpdate 补充foreground早于shown的时序；隐藏/退后台清 C 状态并失效响应，显露后当前 scope/真实身份重新读取，重复信号去重；精确注销实例回调，列表 requestKey 也按实例隔离 | **C 原生接线/逻辑及 HAP 已验证，真实导航/设备仍未验证**。不再等待公共入口提供信号才能接线，但三条实测路径仍阻塞于设备/环境，不能标完整完成 |

## A / B 举报接入交接

复用 `features/user/ReportPanel.ets`，不复制表单或 submit：

- A：targetType 为 DEMAND / SERVICE_PACKAGE，真实需求/橱窗 ID、ownerId、从真实会话读取的 currentUserId；接入既有 onRequireLogin。
- B：用户主页为 USER，真实 userId 与 owner/currentUser；由 B 对齐是否支持相应公开主页入口。
- C：MOMENT，真实 momentId、authorId、currentSession().userId 与登录回调。自己内容不显示入口。
- 在 C-SHARED-03/04 完成前，接入方需知晓既有表单生命周期与跨实例取消限制；C 的单实例挂载只降低本页冲突，不能修复共享层问题。

不申请管理员 PATCH、管理 DTO 或鸿蒙管理入口。

## 续推核查与可转交契约

续推起点为 C 提交 `5e0402a`。本轮已重新 fetch；集成 HEAD 仍为 `b258ec8`，所列公共/B 路径在所有已获取分支上未出现后续修复。PR #25 无维护者授权/修复评论（仅部署机器人反馈）。未获得 B 或公共维护者明确编辑授权，以下契约为**建议、待维护者提供**，C 没有实现到公共文件；关联修复 SHA/PR：**无**。

### C-SHARED-03 / B：ReportPanel 单一实现

目标文件：`harmony/entry/src/main/ets/features/user/ReportPanel.ets`；必要的共享提交状态可由 B 放在 `features/user/ReportSubmissionState.ets`，不新建第二套 UI 或请求层。

接入位置：`submit()` 请求前、成功/异常/finally 三个出口、`aboutToDisappear()`、targetType/targetId/ownerId/currentUserId 的 @Watch 变化处理、取消/关闭按钮。保留全部现有 props 与可选 onRequireLogin；A DemandDetailPage/ServiceDetailPage 和 C MomentFeedPage 原调用不要求同步破坏性修改。

建议内部契约：`onTargetChanged(): void`、`resetTarget(): void`、`isCurrent(generation: number, sessionVersion: number, targetType: string, targetId: number): boolean`；确切命名由 B 决定。捕获对象、会话、实例 generation 与对应 requestKey，**响应、catch、finally** 均核对；目标改变、取消或离页增 generation 并清理旧 busy/submitted/error。原因/说明的保留策略：同对象失败保留；换对象清空；明确取消后保留还是清空需 B 保持一致，不能把 A 的已提交状态带到 B。

只接受正 reportId、匹配 targetType/targetId、合法 PENDING/RESOLVED；服务端“创建成功”不能写成已处理。超时/取消/解析失败可能发生在服务端写入后：保留待核实状态，禁用直接重发，给“核实结果”动作，通过既有 listMyReports 比对当前会话、对象、原因和时间等真实字段。查不到不能证明没有写入，不自动重放、不宣称 exactly-once。待核实记录应在同会话关闭/重开同一对象时保留，不能只存在被销毁组件里；不得把旧账号待核实记录展示给新账号。

已提供可执行交接：`harmony/tests/moment-report-contract.test.cjs`。现代码严格模式实测 **2 通过、7 失败、退出码 1**；其中 5 项属于本条：换目标旧成功、关闭旧异常、换账号旧成功、UNKNOWN 状态、超时盲重发。表单目标变化后的输入/submitted 重置，以及 finally 不覆盖后续提交，还须在 B 实现后补充针对新生命周期处理的测试及 ArkUI @Watch/设备检查；不能把源码存在 @Watch 当作通过。

### C-SHARED-04 / 公共维护者：请求与取消的实例隔离

目标文件：`harmony/entry/src/main/ets/network/ApiService.ets`，当前 createReport/listMyReports/cancelReports 位于同一末段。**不修改 HttpClient 认证与取消策略**；底层已有按 key 隔离，问题是适配层固定 key。

建议兼容签名：

```ts
createReport(payload: CreateReportPayload, requestKey: string = 'reports.create'): Promise<ReportSummary>
listMyReports(requestKey: string = 'reports.my'): Promise<ReportSummary[]>
cancelReports(createRequestKey: string = 'reports.create', myRequestKey: string = 'reports.my'): void
```

新增参数仅透传现有 client.post/get/cancelRequest；不改路径/包装/认证。B 为每个实例/对象生成唯一 key 对，submit/核实/取消使用对应 key；新实例不得因另一实例关闭而被取消。`cancelReports()` 无参保持旧行为兼容，但完成移交的新调用须显式传两个自己的 key，不能取消其他页面的默认 reports.my。

验收：两个表单不同 key 的提交均能完成；取消甲，乙成功不受影响；两个 my 查询互不覆盖；关闭 Feed 不能取消 A 详情表单。严格测试已使用**真实 ApiService/HttpClient + NetworkKit 边界替身**复现后两项请求隔离失败，并非只检查方法名；上面 7 失败中有 2 项属于本条。

维护者核查命令（harmony 目录，先设置本机 SDK/Node）：

```powershell
$env:PORTRA_REQUIRE_SHARED_REPORTS = '1'
node --test tests/moment-report-contract.test.cjs
```

默认全套中这 7 个**新增且已知未实现**的交接要求为会实际执行的 TODO；严格模式去掉 TODO 标识并返回真实失败退出码。没有跳过测试，也没有将原有失败改成 TODO；报表必须单列 TODO，不能写“举报回归全部通过”。公共修复到位后解除 TODO 并运行严格模式，更新必要测试适配/设备验证，再标已整合。

### C-SHARED-01/02 / 公共维护者：点赞与详情

目标：`harmony/entry/src/main/ets/network/ApiService.ets`，紧邻 listMoments/cancelMoments/现有 favoriteMoment 区域，沿用 MomentSummary 与 HttpClient。最新 API 仍无以下方法，C 未导入。

```ts
likeMoment(momentId: number, requestKey?: string): Promise<MomentSummary>
unlikeMoment(momentId: number, requestKey?: string): Promise<MomentSummary>
cancelMomentLike(momentId: number, requestKey?: string): void
getMoment(momentId: number, requestKey: string = 'moments.detail'): Promise<MomentSummary>
cancelMomentDetail(requestKey: string = 'moments.detail'): void
```

点赞默认 key 可沿用 `moments.${momentId}.like`；显式 key 由 C 持有，取消必须对应同一 key。详情 GET `/moments/{id}`，点赞 PUT/DELETE `/moments/{id}/like`，均校验正安全整数；返回匹配对象，错误保持现有映射，不新增 toggle/自动重放。新详情返回全部 imageDataList，Feed 预览不当总图数；请求结果未知先读取详情核实再考虑重发。

C 接入位置：MomentFeedPage 的收藏同级动作/局部详情弹层；MomentCard 增加可选点赞/打开详情回调和默认 busy，继续兼容 B 的 `MomentCard({ item })`。scope/session/视图保护复用 C 生命周期；关闭预览/详情先消费返回，保留列表滚动，重进详情必须重新请求。维护者验收：PUT/DELETE 请求精确、返回 ID/状态合法、取消互不干扰、401/403 保持底座行为；C 接入后覆盖连续点击、异常、换 scope/账号、离页旧响应、9 图详情对比3图 Feed、删除/下架后重入。

### C-SHARED-05 / B：作者入口

公开资料 getPublicProfile 已有，不重复申请；当前没有 C 可复用的公开主页导航实现。请 B 明确实际组件/路由与回调（建议 `onOpenAuthor?: (userId: number, role: string) => void`），由入口维护者统一接线。角色只用真实 DTO 的 CUSTOMER/PROVIDER；缺资料继续角色+ID回退，不能新增第二套用户主页。验收同时覆盖 C 与 B 卡片原调用、身份变化、资料失败及返回位置。

### C-SHARED-07 / 设备验收交接

C 已通过局部 SDK 事件订阅提供接线，公共文件无需为本方案改动。相关实现：MomentFeedLifecycle、MomentFeedPage.observeLifecycle/isRouteVisible/handleVisibility/suspendFeed。来源为本机 SDK26 UIObserver/NavDestinationInfo/NavigationInfo、ApplicationContext/ApplicationStateChangeCallback 声明；方法签名与 ArkTS 编译已验证，不等同事件实际投递已验证。

团队需在实际 Navigation 根内容及 HALL destination 各执行：动态→我的→切身份→返回；动态→我的→退出→返回；动态→后台→前台，以及个人页遮盖时后台恢复后再返回。记录旧状态清除、新 scope 请求、身份及请求次数，并交错旧列表/收藏响应；注销监听不能影响另一个 Feed。HALL destination 可通过现有登录返回路径进入，不要求新建调试路由或修改公共入口。

### 原生测试认证环境交接（不新增C登录任务）

本轮用户已在`https://47.76.106.57`完成合法Web白名单登录并创建专用五图动态；仍不能用于原生登录验收。精确只读来源：`harmony/entry/src/main/ets/pages/LoginPage.ets`的sendCode/signIn、`network/ApiService.ets`的sendLoginCode/verifyLoginCode只支持原生短信，`backend/src/main/java/com/action/camera/tempstaging/TempStagingWebConfig.java`拒绝`/auth/sms/send`、`/auth/native/sms/verify`，`TempStagingAuthController.java`只提供Web LoginResponse与refresh cookie，原生契约则是`auth/dto/NativeSessionResponse.java`。当前前端公开temp-staging标识；后端部署SHA未确认，线上行为须由负责人核对，不能假定为相同版本。

请认证/后端维护者明确**已有、合法且允许原生普通账号登录**的测试环境及实际部署SHA；优先提供原生短信可用环境和正常验证码接手流程。若团队另有现成原生测试登录能力，请给出真实入口、返回契约、受限环境与维护者提交/PR，由公共维护者决定适配位置，不要求C实现白名单登录或修改上述公共文件。兼容要求：沿用AuthSessionManager安全保存与原生refresh/logout，不导出Web token/cookie，不绕过验证码、增设假成功或向C授权管理员权限。

验收：普通作者/举报者各自通过正常原生登录进入，切CUSTOMER/PROVIDER及退出能真实失效会话，refresh/logout有效；完成root/HALL三路径和同reportId跨端链路。用户后来要求的测试管理员已只在专用本地H2空库初始化，并正常Web登录完成本地HTTP＋Web下架/恢复；不构成staging管理员访问或鸿蒙设备证据。C不新增鸿蒙登录、管理员页面或管理接口。
