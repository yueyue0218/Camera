# C 模块阶段性交付与续推记录

日期：2026-10-25（北京时间）。本轮补充 C-SHARED-07 原生事件接线、可执行公共交接和自动环境核查/本地真实 HTTP 验收。**完整 C 模块仍未完成，PR #25 保持 Draft，不自动合并。**

## 基线与边界

- 本轮从已有 C 提交 `5e0402af15d92de80cca1f8beb739831deef16d8` 继续；fetch 后 `origin/integration/harmony-v1` 仍为 `b258ec8114ac1ff8f360099155f5d284f1247c41`，无新的公共修复提交。
- 工作分支 `feature/harmony-c-ui-polish`，复用 C 独立工作区；[PR #25](https://github.com/yueyue0218/Camera/pull/25) 的唯一 base 为 integration/harmony-v1。
- 已核查所有远端分支、开放及历史鸿蒙 PR、PR25 评论/审查；没有 B/公共维护者授权或所需接口修复。关联公共依赖提交/PR：无。历史 #8/#9 已合并，#24 为初始基线草稿，不能视为本轮依赖。
- 原主工作区未提交文件原样保留；未修改 main、公共网络/认证/DTO/全局导航/EntryAbility、B ReportPanel、A/B/D 页面、Web 或后端源码/共享配置。
- SDK 26 和原依赖沿用，未升级或修改签名/TLS。首发沿用 Web 管理，不新增鸿蒙管理 UI/API。

## 本轮文件与真实行为

| 文件（相对仓库） | 用途 |
| --- | --- |
| harmony/entry/src/main/ets/features/moments/MomentFeedLifecycle.ets | C 局部订阅 Navigation 切换、NavDestination shown/hidden 和应用前后台事件；精确注销实例回调，失败清理与安全重试 |
| harmony/entry/src/main/ets/pages/MomentFeedPage.ets | root/HALL 自身可见性判断；隐藏或退后台清 items/currentUserId/举报对象，使旧响应失效；显露后按当前 scope 重读真实列表和身份；重复通知去重 |
| harmony/entry/src/main/ets/features/moments/MomentFeedModels.ets | C 列表实例唯一 requestKey，避免 root/HALL 互相取消；保留 scope/session TTL、去重及跨实例 pending 收藏 |
| harmony/tests/moment-feed-behavior.test.cjs | 根内容/HALL 切身份、退出、后台恢复、重复通知、双实例、部分注册失败、foreground 早于 shown 时序等逻辑回归 |
| harmony/tests/moment-feed.test.cjs | 更新真实接口接线检查，保留原缓存/格式化行为检查 |
| harmony/tests/moment-report-contract.test.cjs | 只读执行 B 实际表单方法及真实 ApiService/HttpClient，提供 7 项未满足要求的严格失败用例 |
| harmony/tests/moment-local-http-check.cjs | 显式 opt-in、仅固定本机端口和独立 H2 smoke 的真实普通账号/动态/互动/举报 HTTP 验收；不生成 token、不创建管理员 |
| docs/harmony/c/c-ui-audit.md | 原阶段成果与本轮任务记录 |
| docs/harmony/c/shared-change-requests.md | C-SHARED-01–07 的最新事实、精确文件/签名/插入位置/兼容性和验收用例 |
| docs/harmony/c/c-module-delivery.md | 本交付、环境来源、分层验证与剩余事项 |

原 MomentCard、Feed 筛选、真实收藏与并发保护均保留；B 的 MomentCard({ item }) 原调用不变，新增回调仍为可选。列表仍是数组 API，不加分页、假数据或完整图数。点赞/详情的鸿蒙公共方法未提供，未导入不存在的方法或建立旁路网络层。

### C-SHARED-07 进度

C 页面在根 Column 的 onAppear 注册局部原生事件，不只依赖组件 aboutToAppear/aboutToDisappear。原生导航通知后重新查询自身 Navigation/NavDestination：根内容按所属栈是否为空；HALL 按自身 index/state 和真实 navDestinationId，不能按同名 Hall 误判其他实例。后台与导航隐藏清状态，显露时重新核对会话：游客显示登录提示，有效会话读取当前 scope 和真实举报身份；未决收藏结束前不发可能读取旧状态的列表请求。

独立审查复现“HALL 的 application foreground 先到、目标仍 hidden，随后单独 shown”的遗漏。已新增用例观察失败，再补 navDestinationUpdate 精确对象处理，23 项 C 页面行为测试通过。跨实例监听和取消均精确对应，不注销其他模块监听，不使用轮询。单纯 tab 销毁保留安全 TTL 快照；导航隐藏/后台会失效 C 快照并强制重读。

**状态：C 接线/逻辑/ArkTS 构建通过，真实 Navigation 和设备三路径未验证，不能写成最终已解决。** 应用前后台事件来自 ApplicationContext；目标 shown/hidden 来自 UIObserver。SDK 声明和实际框架时序有只读核查，设备投递仍需实测。

## 环境自动核查（来源、连通性与授权分开）

| 候选 | 发现来源 | 本次连通性/版本 | 团队用于本轮测试的确认 |
| --- | --- | --- | --- |
| https://47.76.106.57 | GitHub 仓库变量 STAGING_PUBLIC_URL / STAGING_HEALTH_URL / STAGING_EXPECTED_ORIGIN；harmony/README.md；docs/deploy/C_DEPLOY_01_STAGING_CLOSURE.md | TLS 校验成功；GET / 为 HTML 200；GET /service-packages?page=1&size=1 为 HTTP200/业务200；deployment.json 返回前端 gitSha d36689b78922cfa3f4da9b6cf25053ace5667641、environment=temp-staging | 历史配置明确标为 staging；本轮是否可创建测试内容及账号尚无新的团队确认，未做外部写入 |
| 同源 Web 后台 | frontend/src/routes.jsx：/login/admin、/admin/feed、/admin/reports；frontend/src/api/client.js 的 temp-staging 管理/举报走 /api/web | /admin/reports 返回 HTML200；无认证 /api/web/admin/reports、/api/web/reports/my、/auth/session 为业务40101；没有合法管理员访问，不能称管理可用 | 尚待合法访问方式，不创建/提权管理员 |
| PR25 Vercel Preview | PR 的部署机器人评论 | 根地址302，未绕过保护或尝试认证；不能证明后端同源或管理员登录可用 | 未作为测试环境采用 |
| http://47.250.86.6 | 历史 docs/P4/DEMO_GUIDE.md、application.yml CORS 候选 | 有限8秒探测超时（curl28）；历史配置不算可用测试环境 | 无本轮确认，未写入 |
| http://127.0.0.1:18087 | 本轮自行启动的专属进程，smoke + H2内存 portra_c_20261025，仅绑定127.0.0.1 | 普通账号/动态/举报相关真实HTTP验收通过；验收后正常退出账号并停止专属进程，内存数据已释放 | 用户明确授权隔离本地评估/普通账号测试，仅记本地结果 |

公开 deployment.json 是**前端部署标识**，不能推断当前后端必为同 SHA。GitHub deploy.yml 最近显示成功的运行 38253959362 对应 d662b21（2026-10-12）；它与当前公开前端标识不同，分别记录，不伪称本轮后端版本已确认。version.json / release.json 返回 HTML SPA 回退，不是版本 JSON。

### 本机 SDK、模拟器、设备、运行条件

- 已安装 DevEco Studio / SDK 26.0.0、Node/Hvigor/ohpm；HAP 可编译。
- hdc list targets -v：`[Empty]`，无已连接真机/模拟器。
- Emulator.exe -list：`[Empty]`，退出0；Device Manager 配置的镜像目录不存在，deployed 仅版本文件，无已部署机器。程序自带 emulator.json 是设备模板，不能当作已安装镜像。
- 已尝试通过 Computer Use 启动/控制 DevEco 核查 Device Manager，工具返回“Computer Use app approval timed out”；没有绕过应用控制授权。未因此更改系统设置、下载镜像或声称模拟器运行。
- Java17、Maven3.9.16、H2依赖和 MySQL8 程序可用。没有使用现有 MySQL 或其账号，采用独立 H2 内存；关闭 camera.demo.seed-users，未自动创建演示或管理员账号。
- 初始本地启动因 Windows Java NIO Unix 域回环失败；对照已有 JBR25 同样失败。simple HTTP factory 仅移除了首个触发点，Tomcat NIO 仍失败。最小 Selector 程序证明进程级 `jdk.net.unixdomain.tmpdir` 指向本次不存在的临时父目录可触发 JDK 原生 TCP 回退，最终 Java17 启动成功。此属性只作用本次进程，未修改系统或共享配置；未关闭 TLS/鉴权。

## 本地真实 HTTP 验收（独立于鸿蒙/运营商/Web 管理）

手工脚本仅允许 http://127.0.0.1:18087，并要求读取该专属 smoke/H2 进程日志核对来源。使用既有 DevSmsSender 作为本地输出通道，PhoneSmsService 原随机挑战生成、原 /auth/native/sms/verify 验证消费；未用固定验证码、数据库写账号、手工 token 或跳过校验。两组测试号码仅作为此内存库本地输入，无运营商短信发送。OTP、token 不写入报告或提交文件。

| 检查 | 实际结果 |
| --- | --- |
| 两个普通测试账号 | 正常 native 验证创建 authorId=1、reporterId=2，均 CUSTOMER，无管理员 |
| 动态创建/三个 scope | momentId=1；latest/hot/following 均返回真实数组 |
| 预览与详情 | 列表 imageDataList 为3，GET /moments/1 为5张真实测试 PNG，未把预览当完整数量 |
| 点赞 | PUT 两次仍1，DELETE后0，服务器状态 true→false |
| 收藏 | PUT 两次仍1，DELETE后0，服务器状态 true→false |
| 举报 | POST /reports 返回 reportId=1、targetId=1、PENDING；GET /reports/my 读到同一记录 |
| 普通用户权限 | GET /admin/reports 拒绝，业务40301 |
| 清理 | 两个账号走原 native/logout；核对 PID/端口/专属库后停止本次后端，未停止共享服务 |

这是**本地真实后端 HTTP 验收**。不是从鸿蒙 UI 提交，不证明设备交互、运营商投递、MySQL兼容性或 Web 管理闭环。公开 service-packages 本地读取曾因未建 MyBatis provider_profiles 表业务500；未越界修复或掩盖，本地结论限于上表实测接口。

## 命令、退出码与分层结果

命令使用本机现有工具，仓库不记录个人工具绝对路径：

| 层级 | 实际命令 | 退出码 / 结果 |
| --- | --- | --- |
| 远端 | git fetch origin；gh pr list/view、gh variable list、gh run list | 0；公共依赖无更新，环境来源见上 |
| 原阶段历史 | node --test tests/*.test.cjs（当时文件集合） | 0，83/83；不是当前总数 |
| 新生命周期RED | node --test tests/moment-feed-behavior.test.cjs | 1，先缺订阅方法，再复现foreground→hidden→shown遗漏 |
| 当前完整回归 | $testFiles=Get-ChildItem ./tests/*.test.cjs ...; node --test $testFiles | 0，**102项：95通过、7 TODO、0普通失败**；7 TODO实际断言失败，不能算全通过 |
| 公共举报严格回归 | PORTRA_REQUIRE_SHARED_REPORTS=1；node --test tests/moment-report-contract.test.cjs | 1，2通过/7失败；确证C-SHARED-03/04未实现，不削弱原有测试 |
| ArkTS/HAP | hvigorw.bat assembleHap --no-daemon -p product=dev | 最终0，33 tasks（17执行/16 up-to-date）；未签名、PORTRA_BASE_URL空，仅编译包 |
| 初次新增订阅器构建 | 同上 | 1，ArkTS任意类型throw限制；改为明确Error后已重新构建通过 |
| 本地后端构建 | mvn -o -DskipTests package | 0；此命令跳过后端测试，不能称后端全套回归通过；存在原pom JaCoCo重复插件警告，未修无关文件 |
| 本地启动 | java [仅进程JDK回退参数] -jar target/camera-0.0.1-SNAPSHOT.jar --spring.profiles.active=smoke --server.address=127.0.0.1 --server.port=18087 --camera.demo.seed-users=false --spring.datasource.url=jdbc:h2:mem:portra_c_20261025... | 最终启动成功；前面失败和限制已记录 |
| 本地HTTP | PORTRA_LOCAL_HTTP_AUDIT=1、PORTRA_LOCAL_SMS_LOG指向本次日志；node tests/moment-local-http-check.cjs | 0，上表6组实测检查；敏感凭据仅内存 |
| 设备 | hdc list targets -v；Emulator.exe -list | 0，均Empty；真实设备三路径未验证 |
| 差异 | git diff --check | 0；只提交C源/测试/3份文档，产物/日志/个人路径不提交 |

当前HAP没有配置可用于设备的origin：外部staging只做了只读探测，本地后端验收后已停止。没有把localhost包当作真机可达联调包。

## 公共依赖与真实跨端剩余项

| 项目 | 最新状态 / 负责人 |
| --- | --- |
| C-SHARED-07 | C原生事件接线/逻辑/编译已完成；root与HALL的“切身份返回”“退出返回”“后台恢复”仍需设备实测，不能用Node事件替身替代 |
| C-SHARED-03/04 | B/公共维护者尚未授权/提供修复；7项严格用例失败。shared-change-requests含精确兼容签名、插入位置与跨实例取消验收 |
| C-SHARED-01/02 | 公共ApiService点赞/详情方法仍缺；本地后端真实接口已测，不等于鸿蒙已接。未新增假按钮或完整相册 |
| C-SHARED-05/06 | B公开主页入口/真实作者资料与收藏页设备联动待对齐；原只读卡片兼容保留 |
| 签名/设备 | 无签名配置、无实例/镜像、无连接设备，IDE应用控制授权超时；未安装运行 |
| 真实运营商SMS与测试环境选择 | 仍需明确本轮可写测试环境及测试号码/合法验证码获取方式；未尝试绕过临时staging登录 |
| Web管理员 | 无合法访问方式，未创建管理员、重置密码、注入token或处理真实内容 |

| X编号 | 状态 / 证据 |
| --- | --- |
| X01 鸿蒙举报 | 未验证：本地HTTP已生成真实测试reportId=1，但不是鸿蒙UI，不能替代X01 |
| X02 Web查同一举报 | 未验证：无合法管理员访问，本地记录已随内存库停止释放 |
| X03 Web下架 | 未验证：无管理员且未操作外部测试/正式对象 |
| X04 鸿蒙主动刷新/详情 | 逻辑部分通过；设备未验证，鸿蒙详情公共能力仍缺 |
| X05 Web合法恢复 | 未验证；未重复resolve或用作者删除替代管理 |
| X06 IGNORE | 未验证；不推断内容可见性 |
| X07 普通用户管理拒绝 | **隔离本地真实HTTP通过（40301）**；外部环境与设备未验证 |

独立审查无Critical，发现的HALL前台/shown时序Important已RED→GREEN修复；默认TODO与严格失败均按实际结果报告。未宣称C完整完成或具备首发验收条件。
