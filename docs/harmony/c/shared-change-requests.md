# C 公共依赖交付状态

## 2026-10-29：C-SHARED-08 通知精确业务跳转待接入

已核查后端已有订单/评价/评价申诉/订单纠纷的对象ID与用户态GET；鸿蒙当前仍只进订单列表，未精确定位。举报处理后端当前未创建结果通知，不能承诺能从该通知跳转。精确目标文件、建议签名、ID语义、兼容及模拟器用例见[维护者交接](proposals/notification-deep-links/README.md)。086a752没有把这些标为完成。实体设备按用户要求不列本轮条件。

<!-- WEB-UI-MIGRATION-20261028 -->
本轮Web风格迁移已获公共、B、D维护者明确授权并实际应用：HttpClient.patch，通知/信用DTO和ApiService方法，currentSession可选实例key，三受保护原生路由、Hall通知入口、D消息通知标签和B本人信用入口。没有认证旁路、共享主题变更或第二网络层。

原通知占位与信用原生缺失已在本地解除。正式185/185、构建exit0，真实通知2→1→0及本人信用/切角色/前台行为证据齐全。[最终接口/兼容清单](proposals/web-ui-migration/README.md)、[真实验收](evidence/20261028-web-ui/README.md)。旧C-SHARED-01至07成果继续保留。

未实现范围如实保留：Web其他业务深链、动态通知聚合、原生系统推送/全局实时角标、他人私有信用历史；不执行任意navigationPath URL。实体设备按用户要求不列本轮条件；待外部交接仍为团队原生环境/SHA/合法后台和发布签名条件，不能再把“通知后端不存在”或“未获这9文件授权”列作当前原因。

## 此前阶段记录（保留原时点，以顶部本轮状态为准）
<!-- FINAL-20261028 -->
更新：2026-10-28，**本轮共享授权包已实际应用，不再等待代码授权或候选接入**。用户明确确认 B/公共维护者整包授权及新隔离普通双角色 H2 夹具授权；原认证两行和点赞/详情授权继续有效。integration 最新仍 b258ec8，没有另外已更新的公共修复 PR，补丁随 [Draft PR #25](https://github.com/yueyue0218/Camera/pull/25) 交付。

| 编号 | 最新状态 / 精确实现 |
| --- | --- |
| C-SHARED-01/02 | 已接入真实 ApiService.likeMoment/unlikeMoment/getMoment 及对应实例取消；60b6b02 已有本地设备点赞/全5图详情证据 |
| C-SHARED-03 | B ReportPanel + ReportSubmissionStore 已授权应用；提交时捕获对象/actor/逻辑会话/实例generation，response/catch/finally均隔离；目标/身份变化清草稿。unknown 同账号同目标跨角色版本仍禁重复，其他账号不泄露 |
| C-SHARED-04 | ApiService.createReport(payload,key?)、listMyReports(key?)、cancelReports(createKey?,myKey?)，缺省行为保持兼容；每实例精确key。真实 HttpClient回归和设备超时/核实已验证 |
| C-SHARED-05 | B PublicProfilePage 复用既有 getPublicProfile(id,role,key?)、listProfileMoments(id,role,page,size,key?)、cancelPublicProfile(profileKey,momentsKey)，C仅可选作者回调；公共 PUBLIC_PROFILE 路由/参数已授权接线 |
| C-SHARED-07 | C局部真实 UIObserver/Application 信号覆盖root与HALL；Index/Shell动态正常登录→现有Hall(tab1)已授权，重登复用栈顶Hall。两条实际路径的成功切角色/退出/前台恢复均已实测 |
| C-AUTH-01 | 既有5625ce0已修load/clear加密属性，冷启动/覆盖恢复和退出清理证据保留 |

最终全套162/162、严格举报24/24，均0 TODO；assembleHap exit0。最终逐文件补丁/兼容说明见[授权包](proposals/remaining-owner-bundle/README.md)，[本轮设备、跨端及环境证据](evidence/20261028-final/README.md)，完整命令及限制见[delivery](c-module-delivery.md)。A/B/C旧方法和B卡片默认调用保留，未新增第二套表单/请求/用户体系。

**仍需外部交接的只有真实部署与发布验收条件**：可用原生短信测试环境及后端部署SHA、现有合法管理员入口；实体设备授权/签名条件。候选来源 https://47.76.106.57 来自GitHub staging变量及仓库配置，TLS可连通，但“可连通”不等于“已确认允许原生测试”。本地18088/15173和18090为用户授权隔离环境，结果单独记录。当前不申请提权、重置密码或共享配置变更；没有新的缺失方法需要C旁路实现。后端未提供举报幂等请求ID，进程重启后的未知写入去重不作承诺，可作为后续公共能力而不是虚构已支持。

<!-- HISTORICAL-RECORDS -->
## 历史阶段记录（以下状态和计数保留原时点，以本页顶部最新结论为准）

# C 公共依赖与交接

核查基线：`b258ec8114ac1ff8f360099155f5d284f1247c41`。更新：2026-10-28。
以下按项标记真实状态。C-AUTH-01及C-SHARED-01/02已获用户明确确认的对应维护者授权并实现；其余公共/B文件仍只读，未扩大授权。

| ID / 优先级 | 当前缺口、目标文件 / 维护者 | 建议契约 / 生命周期 | 调用方、验收 / 状态 |
| --- | --- | --- | --- |
| C-SHARED-01 / P1 | network/ApiService.ets；已获公共网络维护者授权，新增真实likeMoment/unlikeMoment/cancelMomentLike | PUT/DELETE `/moments/{id}/like`，沿用认证及错误映射，正安全ID/返回对象状态计数校验，兼容默认key，可按实例取消 | **已实现并本地原生验收**：Feed点赞0→1、详情取消1→0，服务器另一普通会话核对；旧响应与结果不明保护已回归。staging/真机未验 |
| C-SHARED-02 / P1 | network/ApiService.ets；已获授权新增getMoment/cancelMomentDetail，C内详情弹层接入 | 真实GET `/moments/{id}`，每次重进重新读取；详情完整图片权威，Feed仍仅3张预览，关闭/会话/后台失效 | **已实现并本地原生验收**：1/5→5/5，关闭重入及系统Back；Web下架详情404清旧卡片，独立恢复后重读可见。staging/真机未验 |
| C-SHARED-03 / P1 | features/user/ReportPanel.ets 属 B，未移交；只校验 status 非空，缺目标/会话/离页版本保护；取消后仍可能处理旧提交。B/协调人 | 状态仅接受 PENDING/RESOLVED；提交前捕获 targetType/targetId/sessionVersion/generation，响应/异常/finally 均检查；目标变化重置 submitted/error 与输入策略；超时/取消提示结果待确认并用现有 listMyReports 核实，不能盲重发。确认后由 B 修复或明确移交 | C 仅复用；同页最多一个表单，举报期间同条收藏互斥。普通提交的本地原生＋Web闭环已通过；共享可靠性仍有7项严格失败，不宣称组件已全面完善 |
| C-SHARED-04 / P1 | ApiService.createReport/listMyReports/cancelReports 固定 reports.create/reports.my；ReportPanel.aboutToDisappear 调 cancelReports。A 详情页、C Feed 可在导航栈同时存在，离开任一实例会取消另一个的提交；HttpClient 同 key 替换也会使旧请求失效。公共维护者 + B | createReport/listMyReports 增加可选 requestKey（保留现有默认参数兼容），取消方法接收同一 key；ReportPanel 为每个实例/对象持有唯一 key，只取消自己；取消不代表服务端未写入，需核实记录 | 关闭 Feed 举报不应取消 A/B 举报；导航覆盖下层页面与快速换目标回归。**待整合**：基于现有调用链与 HttpClient 同 key 策略确认，C 未改底座 |
| C-SHARED-05 / P2 | MomentSummary 无真实作者昵称/头像；公开用户资料 API 已有，公共主页导航入口未给 C；B/协调人 | 复用 B 的真实资料/公开主页回调契约，明确 role、userId 和会话失效；不新增假资料或第二套主页 | MomentCard 当前显示真实角色 + ID、确定性 Avatar 回退。**待对齐**：不阻塞只读卡片 |
| C-SHARED-06 / P2 | B ProfilePage 当前 listFavoriteMoments 在进入/切换时真实读取，C MomentCard 被其只读复用；本地官方模拟器已联验。B | 维持真实重新读取；若引入个人缓存，由 B 定义失效契约。C 收藏成功清空所有 C scope 缓存后只写当前 scope；失败/在途离页清空 C 缓存 | 保留 item 参数；新增属性有默认值、回调可选，ProfilePage 无需改动。**代码兼容、逻辑及本地C/B收藏联动已验证；staging/真机未验** |
| C-SHARED-07 / P1 | 原 Index/Shell 无显露或恢复信号，fetch 后仍无维护者更新。C 已新增 features/moments/MomentFeedLifecycle.ets，局部订阅原生 Navigation 切换、目标shown/hidden与ApplicationContext前后台；不修改公共入口 | 页面重新查询自身 Navigation/NavDestination，根路径按空栈、HALL 按自身 index/state/id 判定；navDestinationUpdate 补充foreground早于shown的时序；隐藏/退后台清 C 状态并失效响应，显露后当前 scope/真实身份重新读取，重复信号去重；精确注销实例回调，列表 requestKey 也按实例隔离 | **root个人页返回、退出返回及有效会话前台恢复已在官方模拟器验证；HALL/成功切身份未验**。正常HALL入口及双身份测试流程仍需维护者提供，不能标完整完成 |

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

团队需在实际 Navigation 根内容及 HALL destination 各执行：动态→我的→切身份→返回；动态→我的→退出→返回；动态→后台→前台，以及个人页遮盖时后台恢复后再返回。记录旧状态清除、新 scope 请求、身份及请求次数，并交错旧列表/收藏响应；注销监听不能影响另一个 Feed。

**设备准备后的路由复核纠正**：之前写“HALL destination 可通过现有登录返回路径进入”没有实际调用证据，现已撤回。全量检索当前ets中的`AppRoute.HALL`仅见PageMap分支、NavigationPolicy路由列表/标签；没有找到正常UI向HALL发起push或LOGIN携带returnRoute=HALL。C动态的登录回调传LOGIN且空参数，成功时只是pop回根内容，不会构造HALL。不能把这个根路径设备结果算作HALL验收。

公共导航维护者目标文件：`harmony/entry/src/main/ets/pages/Index.ets`的AppShell/openPage/completeLogin、`features/shell/PortraAppShell.ets`现有onOpenRoute入口。请明确已有正常UI进入HALL的真实步骤；如确实缺失，由维护者提供正常业务入口或说明该destination是否保留，C不新建调试路由或修改公共导航。建议保留`onOpenRoute?: (route: AppRoute, id?: number) => void`兼容签名，明确哪条现有动作携带`NavigationRouteParam { returnRoute: AppRoute.HALL }`；不得为了测试暗中替换其他业务返回目标。维护者提供入口后，按上面三路径分别记录root/HALL真实NavDestination状态与旧结果失效证据。

### 原生测试认证环境交接（不新增C登录任务）

本轮用户已在`https://47.76.106.57`完成合法Web白名单登录并创建专用五图动态；仍不能用于原生登录验收。精确只读来源：`harmony/entry/src/main/ets/pages/LoginPage.ets`的sendCode/signIn、`network/ApiService.ets`的sendLoginCode/verifyLoginCode只支持原生短信，`backend/src/main/java/com/action/camera/tempstaging/TempStagingWebConfig.java`拒绝`/auth/sms/send`、`/auth/native/sms/verify`，`TempStagingAuthController.java`只提供Web LoginResponse与refresh cookie，原生契约则是`auth/dto/NativeSessionResponse.java`。当前前端公开temp-staging标识；后端部署SHA未确认，线上行为须由负责人核对，不能假定为相同版本。

请认证/后端维护者明确**已有、合法且允许原生普通账号登录**的测试环境及实际部署SHA；优先提供原生短信可用环境和正常验证码接手流程。若团队另有现成原生测试登录能力，请给出真实入口、返回契约、受限环境与维护者提交/PR，由公共维护者决定适配位置，不要求C实现白名单登录或修改上述公共文件。兼容要求：沿用AuthSessionManager安全保存与原生refresh/logout，不导出Web token/cookie，不绕过验证码、增设假成功或向C授权管理员权限。

验收：普通作者/举报者各自通过正常原生登录进入，切CUSTOMER/PROVIDER及退出能真实失效会话，refresh/logout有效；完成root/HALL三路径和同reportId跨端链路。用户后来要求的测试管理员已只在专用本地H2空库初始化，并正常Web登录完成本地HTTP＋Web下架/恢复；不构成staging管理员访问或鸿蒙设备证据。C不新增鸿蒙登录、管理员页面或管理接口。

本机模拟器现已安装官方7.0.0.107/API26镜像并由hdc确认Connected；现有staging unsigned HAP和独立本地dev HAP均实际安装、启动成功，不能继续把“无SDK/镜像/设备”列为当前原因。本地原生测试采用标准`backend/src/test/resources/schema-h2.sql`补齐MyBatis表，独立smoke/H2服务与原Web验收库分离。正常短信注册的PhoneAuthenticationService只ensureCustomerRole，UserService.switchRole要求既有目标角色绑定；尚缺正常可登录的双身份普通测试账号。请认证/用户体系维护者给出已有账号或合法普通角色开通流程；C不改角色校验或给测试账号提权来冒充该路径通过。

### 2026-10-27最新接入事实

HTTPS获取远端成功，integration仍为`b258ec8`，所列举报/点赞/详情公共修复仍无。随后仅C-AUTH-01获用户明确确认的维护者授权并应用。C局部修复了同ID DTO行复用，并对同条举报/收藏加互斥；root前台恢复、个人页返回、退出返回及C/B收藏联动已有官方模拟器真实证据。成功切身份实际被403拒绝，HALL仍无正常UI入口，这两项继续按上述目标文件/步骤交接。

新增**本地原生＋Web**闭环：新H2库`portra_c_admin_20261027`，原生reportId1/MOMENT1→Web查同一记录→Web下架→鸿蒙有效会话重进不可见→Web独立restore→鸿蒙刷新可见；原举报仍RESOLVED。证据与明确范围见 [delivery](c-module-delivery.md)。这解除本地闭环缺证，不解除共享举报可靠性或staging认证/管理员依赖。

当前共享举报严格9项仍2过/7失败；认证两项修复后，最新默认全套107项100过/7 TODO。仍需B按C-SHARED-03、公共维护者按04修复，公共层提供01/02后C才接真实点赞/详情。没有绕过认证另写网络或复制表单；普通提交成功不能代替切对象、旧会话、异常/finally及跨实例取消回归。

### C-AUTH-01 / P1：公共安全存储作用域

续查已将原先“覆盖安装后游客、原因待查”缩小到 `storage/AssetCredentialStore.ets`：save的REQUIRE_ATTR_ENCRYPTED=true，load/clear漏传而默认false。API26设备仅属性查询省略标志返回24000002、设true读到已有1条记录；正常HTTP刷新对照成功。正常登录后39秒无登出/无更新冷启动仍guest，排除15分钟过期与覆盖安装是必要条件。没有读取设备SECRET。

精确目标：load和clear的ALIAS查询各增加一行true，保持现有签名/环境别名/加密强度/A/B/C调用兼容。**用户已明确确认获公共认证维护者授权，两行补丁已应用；其他公共文件仍未授权。** [补丁与实际源码回归](proposals/README.md)、[真实设备证据](evidence/20261027-auth/README.md)。原实现严格2失败、内存候选2通过、适用性检查0；应用后两项无条件通过，认证12/12，全套107项100过/7既有举报TODO，退出均0。原公共auth.test.cjs的alias-only替身未覆盖分区语义，新C契约补足边界而未修改原公共测试。

授权后API26设备已验证真实恢复已有凭据、冷启动及同一unsigned产物覆盖安装；正常退出后加密属性记录NOT_FOUND，重启为游客。临时C诊断已撤回，无诊断最终包再次正常短信登录、冷启动恢复、覆盖恢复及退出冷启动游客均通过。不同环境不互删由真实源码契约覆盖。实体设备、同签名版本升级、锁屏及长时间过期恢复仍未实测；无现存证据要求扩大双分区读写。不得把false解释为SECRET明文或降低加密。


### 2026-10-28：C-SHARED-01/02获授权并接入

用户明确回复“已获公共网络维护者授权，应用补丁并接入验收”。唯一新增公共改动为ApiService.ets的47行适配，精确补丁保留在proposals/moment-api-like-detail.patch；不修改HttpClient/认证/DTO/公共导航/B表单。上文01/02“仍缺”的描述为授权前核查历史，当前以本段及表格为准。维护者独立PR/SHA仍无，此能力随现有C PR25提交。

新增真实源码契约与C状态回归，全套134项127通过/7举报TODO，严格举报仍2通过/7失败；最终assembleHap退出0。真实本地API26已验证点赞/取消、完整五图、关闭重入/系统返回、Web下架后404及恢复重读、同进程后台清详情和同条举报草稿互斥。完整证据见[evidence](evidence/20261028-like-detail/README.md)。未解除03/04/05、成功切身份、HALL和团队环境/真机依赖。
