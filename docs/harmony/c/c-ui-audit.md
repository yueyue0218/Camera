# C UI 与行为验收进展

## 2026-10-29最终：固定相册基线、同色补齐、下拉刷新及发布入口

详情按同相册最高显示图片固定基线，短图以页面同色补齐，切图文字不动；删刷新键改真实下拉，发布按钮单独留足间距。新手机发布表单50/200字、1—9图；2个公共文件已明确授权，沿用现有认证。发布顶部安全区已修。最终构建exit0/15.720秒，包83F6B5B10040D04645C7851004D5D4C8D056678ED7650E19777827675CDD58C6已安装。

全套260/255pass/5fail；独立集成基线认证10/5pass/5fail，五项名称完全相同，本轮无新增回归，不冒充全套通过。真实切图1741=1741、下拉服务端更新/恢复已验证；图库/设备POST仍未验收。[修改、命令、截图、剩余项](evidence/20261029-final-album-publish/README.md)。[本轮PR26](https://github.com/yueyue0218/Camera/pull/26)，唯一base integration/harmony-v1；用户已显式授权检查后推送/合并，实际合并状态以GitHub为准，main不操作。

## 2026-10-29最新：动态卡片、详情互动与举报身份修复

米白页面仅图片区域黑底；点图独立详情、小箭头切图、头像昵称可点。减弱粗蓝边/重印章，删“约拍记录”；爱心/书签只图标+数量、无加载动效，详情也可收藏/取消。返回后二次点图锁与失败核实隐藏锁已修；举报身份实例key，真实刷新/前后台/详情作者返回正常。Mate90Pro API26当前包SHA 87424F5F9AA09D596F71D7A44D766767232B7562BC5F1A2CFB5CD529840BD8CE。

公共b42b2a8已快进复用，C相关64/64通过、assembleHap exit0/21.306秒；全套245仅240通过，5项公共auth旧回归失败，见[C-SHARED-09交接](proposals/shared-auth-regressions/README.md)。[修改文件、真实证据与命令](evidence/20261029-feed-card/README.md)。PR25已由外部18:07:56合并，本轮没有合并操作；后续只交Draft，不改main。不宣称全套或完整发布验收完成，以下旧Draft/旧预览状态按时点保留。

## 2026-10-29：动态卡片及黑底全屏图片预览，待用户审阅

C卡片按Web手机布局迁移，图标+计数，选中红/金，收藏响应保留三张预览；图片进入既有独立MomentDetail全页，去底部弹层/可见“查看详情”“查看作者主页”“上一张”按钮，头像及真实昵称为入口，黑底等比自适应及中央小箭头。仅C文件，公共/B/D/后端/Web未改。237/237、assembleHap exit0，已安装并在当前Mate 90 Pro API26真实点图打开5图详情。按用户要求停在预览等审阅；本轮开关颜色、取消与作者/切图行为完整设备复核尚未完成，不宣称完整验收。逐项边界、实际命令/失败/哈希和截图见[预览证据](evidence/20261029-feed-card/README.md)。原Draft PR25未合并，本轮预览尚未提交推送。

## 2026-10-29：大厅搜索按当前身份接通

已获公共维护者明确授权，仅新增公共Shell搜索接线，铃铛沿用NOTIFICATIONS。**摄影师PROVIDER只搜需求，客户CUSTOMER只搜摄影橱窗；搜索中没有分类按钮或手动范围选择。** 游客先正常登录，开页/查询/分页/前台恢复读取真实currentSession，切身份清旧查询/结果，旧响应和结果点击均有会话保护。C独立控制器/名义委托/呈现及3份回归，复用已有列表API、卡片和详情，不改公共网络/DTO/认证/主题或A/B/D页。

正式234/234、0fail/skip/TODO，18项独立相关复核；assembleHap exit0/19.151秒，HAP SHA256 **A37689A36A8C15C0B3A17EF177D85A9830AC106D70E478251CCBEAB7FD6A333C**。同一普通测试用户真实PROVIDER→CUSTOMER切换后，搜索分别命中需求1/橱窗6条并能进详情；无结果、键盘、真实Home恢复清理、右上铃铛通知均有[模拟器证据](evidence/20261029-header-search/README.md)。[唯一公共补丁/文件SHA](proposals/header-search/README.md)。保持原Draft PR25/base integration/harmony-v1，未合并；本地H2/unsigned不代表团队外部发布验收。

## 前期记录（当前状态以本段为准）

最终补充：模拟器订单通知38→order6、纠纷通知52→dispute2/order7，追评45→review3/order2、评价申诉48→complaint2/review4/order2均实际验证；最终包200字键盘及真实系统Home恢复旧草稿清理通过，见[精确目标证据](evidence/20261029-engagement/native-routing-verification.json)。

## 2026-10-29：手机弹窗最终接入

已获公共/B/D本轮9文件授权并应用。评价、追评、评价申诉、订单申诉/回复与共享举报按原Web米白/深蓝风格，正文统一200字；固定底部按钮、滚动内容、键盘RESIZE。真实模拟器修复按钮填字后禁用冻结、举报取消残留、返回订单列表旧状态，216项回归和assembleHap均exit0。手机键盘/200字、真实提交/超时核实及通知目标见[本轮截图与边界](evidence/20261029-engagement/README.md)。不同包/内存库分开记录；其他屏幕尺寸、大字体未实测。举报结果自动通知仍依赖后端事件，不造假；本轮只要求模拟器，PR25仍Draft。

## 先前记录（以本段为准）

<!-- WEB-UI-MIGRATION-20261028 -->
用户明确要求把现有Web风格迁移至鸿蒙，现通知和本人信用已由真实原生页面替换缺口。米白/深蓝/浅蓝未读卡/黄色身份标签/信用评分圆章沿用Web视觉；动态调整标题、强调线和留白，原交互保持。通知页面短列表已顶对齐，消息入口双标题经实际截图发现后已消除。

本轮用户明确确认公共、B、D维护者9文件授权。正式全套185/185，0TODO；最终HAP exit0/18.149秒，API26实际安装。普通真实互动生成2通知，原生单条/全部已读2→1→0和真实动态详情已实测；信用80/待积累/空记录/说明、前台恢复、普通角色切换后重读均已截图。[三页及行为证据](evidence/20261028-web-ui/README.md)、[交付](c-module-delivery.md)。本轮按用户要求采用模拟器，本地H2结果不等于外部发布验收；PR25仍Draft。

## 此前阶段记录（保留原时点，以顶部本轮状态为准）
<!-- FINAL-20261028 -->
更新：2026-10-28。剩余共享能力已获B/公共维护者授权并接入，C代码及隔离本地验收已完成本轮可执行范围，完整发布验收仍受团队环境、实体设备和签名条件限制；PR25保持Draft。

真实改善：作者进入B只读公开主页；共享举报按对象/账号/实例隔离，未知结果核实且不盲重发；动态正常登录进入现有HALL动态标签，重登不叠栈。root与HALL分别实际成功切角色、退出返回和系统Home恢复，旧草稿/身份/列表均清理。新隔离普通双角色夹具已明确获准，无ADMIN、无既有账号提权。

原库新增普通测试动态2，实际鸿蒙举报report2→Web查同ID→下架→鸿蒙刷新不可见→Web独立恢复→鸿蒙刷新可见，原举报不重复resolve。最终无诊断包在新库真实写入report1后响应延迟触发超时；关闭重开和切角色后仅能核实，实际返回#1，普通只读观察确认总共1条。切其他对象及并发旧响应/取消的处理由严格共享24项回归补充，不用Node冒充导航证据。

全套162/162、0TODO；独立相关46/46；最终assembleHap exit0、16.896秒。原点赞/详情服务器0→1→0、完整5图/Feed3图证据继续有效。[本轮设备、跨端及环境证据](evidence/20261028-final/README.md)及[最新交付](c-module-delivery.md)列出包SHA、精确源文件、真实路由日志、各库对象ID与未验收边界；历史计数和阻塞只代表原时点。

<!-- HISTORICAL-RECORDS -->
## 历史阶段记录（以下状态和计数保留原时点，以本页顶部最新结论为准）

# C 模块现状与实施计划

日期：2026-10-25（北京时间）。依据用户授权的《Portra 鸿蒙 C 模块：Codex 执行指南 V2.0》。

## 工作基线

- 已执行 `git fetch origin`，实际起点为 `b258ec8114ac1ff8f360099155f5d284f1247c41`。
- 独立分支 `feature/harmony-c-ui-polish`，PR base 为 `integration/harmony-v1`。
- 原工作区 main 的未提交 Web 文件及未跟踪目录均保留；不搬运、不代交。
- 已登记分支/工作区中未发现额外鸿蒙 C UI；目前可核对的 UI 来源为上述起点提交。Web moments 分支不是鸿蒙 UI，未合并。
- 未找到根目录及作用域内 AGENTS.md。设备/Preview 尚未验证。

## 现状与边界

| 项目 | 现状、问题与处理 |
| --- | --- |
| 运行入口 | Index → PortraAppShell → MomentFeedPage → MomentCard |
| 保留 | PortraTheme、PortraImage inline data、真实 API、去重、TTL、原页面结构及 B 的只读 MomentCard 调用 |
| 图片 | 列表只有预览，`共 N 张` 会误导；改为明确预览 |
| 筛选 | API 已支持 latest/hot/following，页面固定 latest；增加同风格轻量切换和 scope/session 缓存隔离 |
| 并发 | 收藏缺少离页/会话保护；刷新忙碌字段未使用 @State；快速切换必须丢弃旧结果 |
| 举报 | 复用 ReportPanel，在 C 内提供单一选中对象入口，传真实作者、当前用户与动态 ID；不编辑 B 的表单 |
| 点赞/详情 | 公共 ApiService 缺失；登记依赖，不绕过认证，不展示假详情或把列表预览当相册 |
| 管理 | 只读核对现有 Web/后端契约；不新增鸿蒙管理员 UI/API |

## 实施计划

Goal：完善 C 可独立完成的真实动态行为及举报入口，记录公共与环境阻塞。
Architecture：沿用原 ArkTS/ArkUI 页面；C 模型承接 scope 缓存和请求生命周期，页面通过 AppClient 调用已有 API；举报仅引用既有 ReportPanel。
Tech Stack：ArkTS / ArkUI Stage / Node test / DevEco SDK 26.0.0。

全局约束：只编辑 C 页面、features/moments、必要 C 测试和 docs/harmony/c；公共、A/B/D、后端及 Web 默认只读；不增加依赖、假数据、支付或管理入口。

重点复核：快速 scope 切换；会话/离页旧响应；刷新与收藏交错；多实例举报取消；下架后主动重新读取。

### Task 1：Feed 与收藏生命周期

文件：MomentFeedModels.ets、MomentFeedPage.ets、MomentCard.ets、moment-feed.test.cjs。
接口：缓存 read/write 增加默认 latest 的 scope 参数；C 请求状态区分视图 generation、列表版本与互动在途；页面仍调用 listMoments(scope) 和 favorite/unfavoriteMoment。

- [x] 新增行为测试：scope/session 隔离、过期、快速切换、离页/会话旧响应、重复互动与刷新覆盖。
- [x] 运行新增测试，确认因当前缺口失败。
- [x] 最小实现 scope 切换、缓存隔离、刷新/收藏反馈；保留真实结果与 B 卡片兼容。
- [x] 运行 C 与 user-system 测试，独立审查后的跨实例修复已完整回归 83/83；待审查后集中提交本阶段 C 文件。

### Task 2：举报接入与公共交接

文件：C 页面、必要 features/report 组件、C 行为测试、shared-change-requests.md。
接口：ReportPanel({targetType:'MOMENT', targetId, ownerId, currentUserId, onRequireLogin})；当前用户来自真实 currentSession()，不解 token。

- [x] 测试单一举报对象、自己内容过滤、会话与离页失效。
- [x] 复用既有表单，避免多卡片同时挂载多个 ReportPanel；目标切换采用销毁/重建，清理 C 选中对象。
- [x] 记录 B 表单及公共 API 的真实缺口，不越界修改。
- [x] 核对举报和 Web 契约并回归，未取得真实环境证据的项目保持未验证。

### Task 3：验证与交付

- [x] 跑现有全部 tests/*.test.cjs，83/83，退出码 0。
- [x] assembleHap，SDK 26.0.0/product dev，退出码 0，未签名且网络禁用。
- [x] 设备、真实后端及 X01–X07 分别记录证据或阻塞原因。
- [x] 检查 diff 范围与敏感信息，完成独立审查与跨实例收藏修复；无 Critical/Minor，导航生命周期 Important 登记 C-SHARED-07。
- 交付方式：提交并尝试创建阶段性草稿 PR；不合并。远端结果以实际 Git/PR 操作为准，不能标完整 C 完成。

## 续推计划（2026-10-25）

续推起点 `5e0402af15d92de80cca1f8beb739831deef16d8`；fetch 后集成分支与公共路径均未更新，PR #25 OPEN/Draft，无维护者授权评论。专属工作区干净；祖先 `.codex/AGENTS.md` 存在但为 0 字节，仓库作用域内无其他 AGENTS.md。

采用 C 局部原生事件订阅，不改 Index/Shell/认证/EntryAbility：UIObserver `navDestinationSwitch` 驱动重新查询自身 Navigation/NavDestination 信息，`navDestinationUpdate` 补充窗口显露/隐藏的目标状态，ApplicationContext `applicationStateChange` 驱动前后台状态。根内容按所属 stack.size() 判断，HALL destination 按自身 index/state/id 判断，不按页面名误认另一个 HALL 实例。当前应用为 Stack 模式。SDK 26 声明已核对，事件只注册本实例回调且精确注销，不使用轮询。

- [x] Task 4 / 生命周期：先增加真实事件适配器与页面处理的失败用例，再实现 C 专用订阅；隐藏时清列表/身份/举报并失效请求，显露时按当前 scope 重读；重复通知不重复请求，隐藏期间前台恢复不误加载。独立审查发现foreground先于shown的遗漏，已新增失败用例并修复；23项C页面行为通过。设备投递未验证。
- [x] Task 5 / 公共交接：只读复现 B 表单与固定网络 key 的目标变化/离页/账号及跨实例问题；提供精确文件/签名/插入位置/兼容与7项严格失败用例。不复制生产表单或越界修改。
- [x] Task 6 / 验证材料：完整102项=95通过+7已知公共依赖TODO；严格举报模式2通过7失败exit1；最终HAP exit0。自动核查GitHub变量/部署、镜像/设备，并完成隔离本地普通账号真实HTTP检查；三份文档按证据更新。提交/草稿PR状态以实际远端操作为准。

三条真实验收路径（切身份返回、退出返回、后台恢复）均需真实 Navigation/设备证据；Node 注入事件只证明适配器及处理逻辑。按用户后续要求已先自行核查：GitHub staging变量与公开deployment.json、只读连通性、Web路由、远端公共修复、SDK/空模拟器列表/无连接设备；未对历史外部环境写入。明确隔离本地smoke/H2后完成普通账号、动态、举报和权限拒绝，未创建管理员。环境来源/授权区别、启动故障及限制均见交付文档，后续仅需无法自行取得的测试环境选择、合法管理员访问及设备/IDE控制授权。

## 授权后的准备进展

用户明确允许staging本轮专用测试数据写入和DevEco控制。已重新核查远端/部署，公共依赖仍未更新；使用进程环境配置构建product=staging的真实HTTPS origin包，退出0，未签名/未安装。生成配置、HAP大小/摘要见交付记录，不提交产物。

DevEco本次控制成功，C工程已打开，设备管理器到达首次软件许可/可选体验计划对话框，需用户审阅选择；不再重复索取已授予的控制/环境许可。浏览器实查普通入口为现有白名单账号登录，不发短信/不开放注册；普通和管理员登录页已准备，缺实际合法账号会话，未尝试凭空造账号或绕过认证。hdc仍Empty，真实导航/跨端待上述条件完成。

## 接手后的实际验收补充

用户已完成普通Web登录及软件许可：staging正常发布了专用五图动态`C验收20261025-98c3e60-01（仅测试）`，界面No.000002，详情实际1/5→2/5；原有其他动态未操作。软件许可配置已agree，进入设备管理器并尝试官方26手机镜像下载；日志确认IDE HTTP Java回环异常。仅进程VM参数重启又遇.port套接字/目录锁错误，未删除共享锁、更改系统网络或全局VM设置，模拟器仍未部署/运行。

staging普通会话没有管理权限；用户随后要求提供测试管理员，因此仅在全新loopback smoke/H2内存库初始化一个隔离测试管理员，使用正常密码认证登录现有Web后台。复用C本地HTTP验收逻辑建立普通作者/举报者、momentId1及reportId1；Web查同一举报、下架，普通HTTP确认Feed缺失/详情40401；Web独立恢复，正常短信间隔后普通HTTP确认Feed恢复/详情200且5图，举报仍RESOLVED/TAKE_DOWN。没有二次resolve、token注入或staging账号提权。随机凭据、夹具、日志及截图不提交；本地后台loopback进程与已登录页签保留供接手，停止前重新核对PID/端口/夹具身份。

本轮只补证据与三份文档，未重做C已有代码。原生LoginPage仅支持短信，而仓库temp-staging拒绝短信、只给Web登录契约；已将精确文件、现成环境/维护者能力请求、兼容要求与验收放入shared-change-requests。实际线上后端SHA未证实，不凭Web登录成功推断原生可登录。本地HTTP＋Web结果单独记录；root/HALL三路径、真实鸿蒙举报及外部完整闭环仍未验证，PR25保持Draft。

## DevEco故障续查与模拟器进展

同一JBR25对照证明默认临时目录Selector失败、工作区临时目录成功，显式工作区UNIX bind可成功清理；原用户缓存特殊.port无法访问/改名，保持原状。改为工作区独立IDE配置/缓存/日志/JDK临时目录，通过官方启动器正常打开C工程，第二次启动也成功。官方26镜像实际下载并安装，专属Portra_C_API26冷启动报告WHPX正常，hdc确认127.0.0.1:5555 Connected/API26/7.0.0.107。

现有staging unsigned HAP在该模拟器实际安装、启动成功；真实大厅→C动态游客提示→原生登录页已观察。随后构建仅连接loopback的dev包，退出0并成功更新安装。原Web验收H2库保留；设备专属新H2库使用仓库schema-h2.sql补齐MyBatis表，原C HTTP脚本正常准备账号/动态，端口转发设备18088→本机18089。没有改公共认证/网络、系统安全设置或共享源码；模拟器接受unsigned不代表真机签名就绪。

HALL路由交接已纠错：当前只有声明/PageMap分支，没有发现正常UI进入调用，动态登录成功仅pop回根内容。不能再声称可用现有登录返回进入HALL；维护者需提供真实入口，C不新建调试路由。模拟器输入法隐私由用户处理，随后窗口最小化与工具手动操作保护冲突，待还原后继续真实会话路径；这些路径仍未标通过。完整命令、失败、包摘要和证据层级见delivery。

## 2026-10-27续推：原生证据与行复用修复

上述窗口阻塞已解除。官方模拟器实际完成root个人页返回、退出返回、有效会话Home→前台重读及旧举报草稿清理，C收藏/取消收藏与B只读收藏页联动也已验证。成功切身份仍缺合法双角色账号（实际切换403），HALL仍无正常UI进入调用；不能把root结果套用到HALL。

真实设备发现同ID卡片在强制重读后仍保留旧DTO。C仅调整ForEach键为视图版本＋DTO内容，新增RED→GREEN回归并在同进程前台恢复验证。审查发现举报中收藏同条动态会重建表单，随后增加C局部互斥与两个先失败后通过的行为测试；其他行仍可收藏，关闭举报后恢复。B表单/公共网络/认证/DTO/导航未修改。

新隔离H2库 `portra_c_admin_20261027` 中，鸿蒙正常登录的普通账号3提交一次reportId1/MOMENT1，Web核对同ID和唯一测试标记后下架；鸿蒙有效会话重进确认不可见；Web独立恢复后鸿蒙刷新确认可见。原举报只读核对仍RESOLVED，没有二次resolve。此闭环为本地验收，不是staging验收，也不同于旧库同号HTTP记录。Windows浏览器URL识别故障通过内置浏览器明确URL及正常表单登录解决，未降低安全检查。

当前全套105项98通过/7共享TODO，严格举报2通过/7失败；完整命令、构建、证据及剩余依赖见 [delivery](c-module-delivery.md) 和 [证据目录](evidence/20261027/README.md)。PR25保持Draft，完整C模块仍未验收完成。

### 后续定位、授权修复与设备验收C-AUTH-01

持久会话问题进一步复现为正常登录后39秒、不覆盖安装仅冷启动仍guest。API26只查安全存储属性：公共查询省略REQUIRE_ATTR_ENCRYPTED为NOT_FOUND，同别名设true得到已有记录1；save已true，load/clear漏传。后端真实refresh对照通过，未导出设备SECRET。新增C契约原实现严格2失败、内存两行候选2通过；随后用户明确确认公共认证维护者授权，只应用这两行，无其他公共源码改动。

已授权修复实际在API26恢复原有凭据，无需新短信；force-stop/start、同一产物覆盖安装后Feed及收藏恢复。正常退出后加密记录为NOT_FOUND，冷启动为游客。临时C诊断已移除，无诊断最终包重新正常登录后再次通过冷启动/覆盖恢复及退出冷启动游客；共10次实际UI断言通过。认证相关12/12，全套107项100过/7既有举报TODO，退出均0；最终assembleHap退出0、15.412秒，SHA256 `318E4AF5BC3F8D1C8877398F928F9BFC7B9EA134303687DE5D58A9C7BC94675B`。详见[授权修复](proposals/README.md)与[真实证据](evidence/20261027-auth/README.md)。实体签名升级及外部环境仍未验收，完整C仍不宣称完成。


## 2026-10-28：点赞与完整详情

获公共网络维护者明确授权后，现有ApiService补齐真实GET/PUT/DELETE及实例取消，C Feed可点赞/取消、进入详情。详情全文和完整图片只按本次GET响应，1/5至5/5实际可达；Feed仍预览3张。可选回调和默认属性兼容B只读卡片，公共导航/认证/B表单未新增改动。

本地API26与Web实际验证：原生点赞后服务器1，详情取消后服务器0；关闭重进/系统Back正确；Web独立下架后原生详情404清旧卡片，合法恢复后重读完整5图并刷新Feed可见；真实系统桌面后同PID19730恢复清详情。同条未提交举报草稿阻止点赞和详情，草稿不丢且没有新举报。

审查发现的旧响应/旧404/核实绕过/删除标记残留均补失败回归后修复，复核无Critical/Important。最终全套134项127通过7既有举报TODO、exit0，严格举报2过7失败、exit1；HAP最终exit0、24.445秒、SHA256 6BBF07CB67229B1484E7DDD2ECBC0B54E6DEC7A32EC59ED7F74E05A7FCE5899E。早期3次ArkTS编译失败及快速Home采集断言失败均如实记录；完整截图和范围见[本轮证据](evidence/20261028-like-detail/README.md)。staging/真机及完整C仍未验收完成。
