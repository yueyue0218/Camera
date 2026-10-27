# C 模块阶段性交付与续推记录

更新：2026-10-27（北京时间）。从已有阶段性交付继续，补充原生事件接线、环境恢复、真实模拟器回归、C行复用修复及获明确授权的安全存储两行修复。下文保留各轮历史结果，最新验证见末尾C-AUTH-01。**完整 C 模块仍未完成，PR #25 保持 Draft，不自动合并。**

## 基线与边界

- 本轮从已有 C 提交 `5e0402af15d92de80cca1f8beb739831deef16d8` 继续；fetch 后 `origin/integration/harmony-v1` 仍为 `b258ec8114ac1ff8f360099155f5d284f1247c41`，无新的公共修复提交。
- 工作分支 `feature/harmony-c-ui-polish`，复用 C 独立工作区；[PR #25](https://github.com/yueyue0218/Camera/pull/25) 的唯一 base 为 integration/harmony-v1。
- 已核查所有远端分支、开放及历史鸿蒙 PR、PR25 评论/审查；未发现所需举报/点赞/详情接口修复，关联维护者提交/PR仍无。唯一新增授权是用户确认公共认证维护者允许C-AUTH-01两行修复，随本PR提交。历史 #8/#9 已合并，#24 为初始基线草稿，不能视为本轮依赖。
- 原主工作区未提交文件原样保留；未修改 main、公共网络/DTO/全局导航/EntryAbility、B ReportPanel、A/B/D 页面、Web或后端源码/共享配置。公共认证唯一改动为获授权的AssetCredentialStore.load/clear各一行true；没有修改认证流程或加密强度。
- SDK 26 和原依赖沿用，未升级或修改签名/TLS。首发沿用 Web 管理，不新增鸿蒙管理 UI/API。

## 本轮文件与真实行为

| 文件（相对仓库） | 用途 |
| --- | --- |
| harmony/entry/src/main/ets/storage/AssetCredentialStore.ets | 获维护者授权，load/clear查询各补REQUIRE_ATTR_ENCRYPTED=true，与save一致；保留既有签名/别名/命名空间及调用兼容 |
| harmony/tests/moment-auth-storage-contract.test.cjs | 实际编译公共存储源码，验证加密作用域读取/删除、环境隔离和重复清理；2项无条件回归 |
| docs/harmony/c/proposals/、evidence/20261027-auth/ | 两行可审阅补丁、官方规则、修复前失败及授权后实际模拟器恢复/清理证据；不含令牌和诊断产物 |
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

**最新状态：C 接线/逻辑/ArkTS 构建通过；官方模拟器 root 真实个人页返回、退出返回与有效会话前台恢复已有证据。成功切身份及 HALL 三路径仍未验证，不能写成最终已解决。** 应用前后台事件来自 ApplicationContext；目标 shown/hidden 来自 UIObserver。具体通过范围、失败对照和剩余依赖见后文。

## 环境自动核查（来源、连通性与授权分开）

| 候选 | 发现来源 | 本次连通性/版本 | 团队用于本轮测试的确认 |
| --- | --- | --- | --- |
| https://47.76.106.57 | GitHub 仓库变量 STAGING_PUBLIC_URL / STAGING_HEALTH_URL / STAGING_EXPECTED_ORIGIN；harmony/README.md；docs/deploy/C_DEPLOY_01_STAGING_CLOSURE.md | TLS 校验成功；GET / 为 HTML 200；GET /service-packages?page=1&size=1 为 HTTP200/业务200；deployment.json 返回前端 gitSha d36689b78922cfa3f4da9b6cf25053ace5667641、environment=temp-staging | 用户明确授权本轮专用测试数据写入及DevEco控制，随后亲自完成普通账号登录；已通过正常Web发布流程创建专用五图动态，见后文 |
| 同源 Web 后台 | frontend/src/routes.jsx：/login/admin、/admin/feed、/admin/reports；frontend/src/api/client.js 的 temp-staging 管理/举报走 /api/web | /admin/reports 返回 HTML200；无认证 /api/web/admin/reports、/api/web/reports/my、/auth/session 为业务40101；没有合法管理员访问，不能称管理可用 | 尚待合法访问方式，不创建/提权管理员 |
| PR25 Vercel Preview | PR 的部署机器人评论 | 根地址302，未绕过保护或尝试认证；不能证明后端同源或管理员登录可用 | 未作为测试环境采用 |
| http://47.250.86.6 | 历史 docs/P4/DEMO_GUIDE.md、application.yml CORS 候选 | 有限8秒探测超时（curl28）；历史配置不算可用测试环境 | 无本轮确认，未写入 |
| http://127.0.0.1:18087 | 本轮自行启动的专属进程，smoke + H2内存 portra_c_20261025，仅绑定127.0.0.1 | 普通账号/动态/举报相关真实HTTP验收通过；验收后正常退出账号并停止专属进程，内存数据已释放 | 用户明确授权隔离本地评估/普通账号测试，仅记本地结果 |
| http://127.0.0.1:18088 / Web http://127.0.0.1:15173 | 用户随后明确要求提供测试管理员；本轮专属smoke/H2 portra_c_admin_20261025及现有Web源码的本地Vite进程 | 正常管理员密码登录、Web查同一reportId、下架/独立恢复与普通用户重新HTTP读取通过；两个服务均实查只绑定127.0.0.1 | 仅此新建空内存库初始化测试管理员；未创建或提权staging账号，结果不算鸿蒙设备/外部闭环 |

公开 deployment.json 是**前端部署标识**，不能推断当前后端必为同 SHA。GitHub deploy.yml 最近显示成功的运行 38253959362 对应 d662b21（2026-10-12）；它与当前公开前端标识不同，分别记录，不伪称本轮后端版本已确认。version.json / release.json 返回 HTML SPA 回退，不是版本 JSON。

### 本机 SDK、模拟器、设备、运行条件

- 已安装 DevEco Studio / SDK 26.0.0、Node/Hvigor/ohpm；HAP 可编译。
- 初次核查hdc list targets -v为`[Empty]`，当时无已连接真机/模拟器；后续Connected实证见恢复补充。
- 初次Emulator.exe -list为`[Empty]`，退出0；当时镜像目录不存在、deployed仅版本文件。后续已实际安装镜像和新建专属实例，不再以模板冒充已部署机器。
- 早期Computer Use控制曾超时，之后已成功打开设备管理器；用户亲自接受软件许可，配置实查为agree。官方26手机镜像下载因IDE Java HTTP回环异常未开始；进程级参数重启随后遇到.port套接字/目录锁异常，未删除共享锁或更改全局VM配置，详见补充记录。
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

最初dev构建时网络禁用；用户确认staging授权后另构建该HTTPS origin的staging HAP，后续设备验收又单独重建本地dev包，均见补充记录。最初18087本地后端已停止；没有把未配置转发的localhost编译包当作真机可达联调包。

### 用户授权后的 staging / Device Manager 进展

- 用户已明确允许本轮使用上述staging测试环境及DevEco控制。重新fetch无公共修复更新，远端C为98c3e60；公开deployment.json仍为前端d36689b、temp-staging。
- 当前终端设置 `PORTRA_BASE_URL=https://47.76.106.57` 后执行 `hvigorw.bat assembleHap --no-daemon -p product=staging`：**退出0，33 tasks全部执行，32.916秒**。生成BuildProfile实查环境staging与该HTTPS origin一致，未改共享配置、SDK或TLS。
- 生成 `harmony/entry/build/staging/outputs/staging/entry-staging-unsigned.hap`（1,282,569字节）；SHA256 `4BF253A8626C54C1BADB701D787040C78A89F4A18DDA11E7A56DC3E8227F1740`。仍未签名，未安装；产物不提交Git。
- DevEco控制本次成功，已打开C专属harmony工程并进入Tools→设备管理器。首次使用弹出《HarmonyOS软件许可及服务协议》及可选“用户体验改进计划与隐私”；尚未由用户完成审阅与选择，未代为接受或更改隐私选项。当前停留在具体协议对话框，不再把应用控制授权列为缺失。
- IDE出现过内部HTTP服务/项目同步异常提示，CLI HAP独立构建通过；不以CLI成功冒充IDE同步或设备安装成功，未改全局VM/系统配置。
- staging实际页面已用浏览器核实：`/login/sign-in`明确为“临时测试环境·不发送短信或邮件”“白名单测试账号登录”“不支持注册或任意手机号登录”；`/login/admin`为现有管理员账号/密码入口。未猜账号、走临时旁路、绕过验证码或注入token。
- 普通/管理员登录页已保留供合法登录接手；没有现成会话，尚缺负责人预置的普通测试账号访问方式及合法管理员登录。浏览器密码无需发送至聊天。账号获取不能由本轮写入授权自动替代。
- 授权后 `hdc list targets -v`仍为Empty，无已运行模拟器/设备；许可处理后才能继续镜像准备，设备三路径和X01–X07状态不作虚假提升。

### 普通账号接手、模拟器与本地测试管理员补充（2026-10-25）

以上是接手前的历史记录；当前普通Web账号登录和软件许可已不再列为待用户授权事项。

- 用户完成staging普通账号登录后，页面显示“测试用户3”。通过原发布对话框填写专用标题`C验收20261025-98c3e60-01（仅测试）`，上传5张本轮生成的标记测试PNG，点击发布后显示“发布成功”。界面编号`No. 000002`，时间`2026/10/25 18:39:54`；原动态`No. 000001 / 嘿嘿`未操作。详情抽屉实际显示`1 / 5`，下一张后`2 / 5`。这是Web侧测试对象准备，不是鸿蒙详情或举报证据；界面编号按当前源码DTO对象ID生成，未将列表位置推断为新reportId。
- 普通会话访问`/admin/reports`及`/login/admin`均返回大厅。已走正常退出后重新打开管理员表单。用户表示没有现成管理员登录方式并要求提供测试管理员；没有尝试猜测staging凭据、重置密码、从浏览器取token或将普通用户提权。
- DevEco软件许可第二次处理后实查`HarmonyOS_Software_Service_Agreement:agree`，进入“我的设备”并选择官方`Huawei_Phone / HarmonyOS 7.0.0(26.0.0)`，确认下载。实际无下载进度/无镜像：IDE日志`HttpUtil.<clinit>`报`Unable to establish loopback connection`，后续`ChooseDeviceImageStep`失败。按本机最小JDK实验，将回退属性放入本次scratch VM options，由官方启动器的`DEVECOSTUDIO_VM_OPTIONS`仅进程加载；未修改用户/安装目录VM配置。正常退出IDE后重启又因系统目录`.port`无法访问、AF_UNIX bind/connect报错而失败，官方应用入口重试也未出现可用窗口；未删除共享锁或伪造SDK许可。镜像、实例、签名与设备仍未就绪，IDE重启问题真实记录，不能称模拟器已启动。
- 独立只读核查原生认证：`pages/LoginPage.ets`与`network/ApiService.ets`仅走`/auth/sms/send`、`/auth/native/sms/verify`，需要`NativeSessionResponse`的access/refresh；仓库`TempStagingWebConfig.java`明确拒绝短信入口，`TempStagingAuthController.java`返回Web LoginResponse并设置HttpOnly refresh cookie。公开前端为temp-staging，后端实际SHA仍未知，因此这是代码/环境不匹配证据，不能推定线上后端全部版本。普通Web登录不等于原生可登录；已加入维护者交接，不给C新增登录、WebView或token注入。

#### 本地管理员与Web闭环（单独证据）

用户要求测试管理员后，复用现有`StagingRoutingHttpCheck`的隔离夹具方式，在scratch运行器中固定smoke、loopback、专用H2内存、禁用demo种子；启动后再次断言profile/数据库且用户表为空，再通过既有实体及BCrypt初始化一个测试管理员（adminId=1）。随机凭据只保留本机scratch文件，无token预置，不提交Git、不输出密码。没有改后端/Web源码或共享配置。浏览器原`/login/admin`用户名/密码认证成功进入管理概览。

复用既有C本地HTTP脚本，scratch副本只替换专用loopback端口与H2日志标记：普通账号仍走真实随机挑战与原native验证，authorId=2、reporterId=3，创建momentId=1（5图）、reportId=1/PENDING；三个scope、点赞/收藏幂等和普通管理拒绝再次通过。不是从鸿蒙UI发出。

| 顺序 / 实际入口 | 结果 |
| --- | --- |
| Web `/admin/reports`、查看举报 | 显示同一`reportId=1`、`MOMENT #1 / PENDING`及专用测试说明 |
| Web“下架内容”，填写原因提交一次 | 提示举报处理成功，动态管理显示`No.000001 HIDDEN` |
| 普通用户新登录后GET Feed、GET `/moments/1`、GET `/reports/my` | Feed不包含1；详情业务40401；同一举报RESOLVED/TAKE_DOWN |
| Web `/admin/feed`“恢复展示”，填写独立恢复原因 | 提示成功，动态显示VISIBLE；使用独立restore流程，未第二次resolve已处理举报 |
| 普通用户正常间隔后重新登录并再次GET | Feed包含1；详情业务200且完整5图；举报仍RESOLVED/TAKE_DOWN |

恢复后第一次重新发送短信因原间隔限制返回40001，脚本退出1；未改限流、固定OTP或跳过验证，正常间隔后再次运行通过（退出0）。本次测试未承诺推送，也未用作者删除/新建替代下架恢复。

实际命令/退出码：`mvn -o dependency:build-classpath '-Dmdep.outputFile=target/c-local-audit/classpath.txt' '-DincludeScope=runtime'`退出0（初次未引用的PowerShell参数解析失败退出1后已纠正）；`javac ... PortraCLocalFixture.java`退出0；`java [进程JDK参数] -cp [既有target/classes及依赖] PortraCLocalFixture [本机凭据输出]`启动成功；`node [scratch]/harmony-c-local-admin-http-check.cjs`退出0；`node [scratch]/harmony-c-local-visibility-check.cjs hidden`退出0；同命令`restored`首次1、间隔后0。scratch运行器/凭据/日志/截图不提交，未修改常规回归集合；本次没有重跑未改变的102项和HAP，沿用前述实际代码验证结果。

本机截图：`harmony-c-staging-five-images.png`、`harmony-c-local-web-hidden.png`、`harmony-c-local-web-restored.png`，以及JSON可见性证据，均在本轮scratch中。供接手的本地Web后台已保留登录页签；后端监听18088实际PID18532，Web监听15173/PID5744，仅loopback，内存数据随专属后端停止释放。后续停止前必须重新核对PID、端口与专属运行器身份，不能按旧PID盲停。此本地测试管理员不能登录staging。

## DevEco恢复与首轮真实模拟器运行补充（2026-10-25）

前述“无镜像/无连接设备”和IDE启动阻塞现已解除，以下为后续实际结果，不覆盖之前的失败记录。

1. 无DevEco进程时，原用户缓存`.port`为零字节ReparsePoint，`fsutil reparsepoint query`及单文件`Move-Item`备份均报系统无法访问；未删除/改动该文件。最小Java对照：同一JBR25默认临时目录`Selector.open()`失败；进程设置`jdk.net.unixdomain.tmpdir`为工作区已有临时目录后成功。工作区显式UNIX bind及清理均成功。这不支持“JDK本身完全不可用”的判断。
2. 通过官方`devecostudio.bat`与仅进程`DEVECOSTUDIO_VM_OPTIONS`，将`idea.config.path`、`idea.system.path`、`idea.log.path`及JDK临时目录放入工作区独立目录。C工程正常打开；正常退出后的第二次启动也成功，旧用户配置/缓存、安装目录VM选项、系统环境变量与网络安全设置均未修改。个人启动器和说明保存在本机scratch，不提交Git。
3. 官方SDK Setup实际下载约1.95GB手机镜像并显示install task finished；来源为华为`update.dbankcdn.com`的`system-image-phone_all-x86.zip`。`Emulator.exe -imageList -deviceType phone -downloaded true`确认HarmonyOS7.0.0/API26、SoftWareVersion7.0.0.107。通过设备管理器新建专属`Portra_C_API26`，4GB RAM/6GB ROM，未覆盖已有设备。
4. `Emulator.exe -start Portra_C_API26 -bootMode coldboot`报告`Windows Hypervisor Platform accelerator is operational`；启动命令保持运行不是失败退出。`hdc list targets -v`确认`127.0.0.1:5555 TCP Connected`；设备`param get const.ohos.apiversion`为26，软件版本`emulator 7.0.0.107(SP8DEVC00E999R4P11)`。本机虚拟化固件已启用、HypervisorPresent=true，未更改Hyper-V/BIOS或安全选项。
5. `hdc -t 127.0.0.1:5555 install [entry-staging-unsigned.hap]`实际成功，退出0；`shell aa start -b com.portra.app -a EntryAbility`成功、退出0；进程5595曾实查运行。非阻塞`hilog -x -P 5595 -L E`当时为空；初次将两个互斥日志模式组合报-31，已纠正，不算有效日志检查。**模拟器接受unsigned包不代表签名问题在真机或发布环境已解决。**
6. 已通过真实模拟器点击大厅→动态，看到C游客提示“登录后可查看真实动态Feed / 去登录”，再点击进入原生登录页。并非Node手调生命周期。此时尚无登录状态，不能据此宣称旧账号列表/举报清理、切身份、退出及前台恢复三路径通过。

### 独立本地设备包与测试库

因为staging原生认证仍有前述缺口，按既有本地验收授权另构建dev：`PORTRA_BASE_URL=http://127.0.0.1:18088`、`hvigorw.bat assembleHap --no-daemon -p product=dev`，退出0，33 tasks（23执行/10 up-to-date），1min12.095s；生成BuildProfile实查dev和该origin。包SHA256为`ADA8B08A27758BE60729F3C14E6F1EEEBA72A23B39C3914E5C710CF155A14857`。`hdc install -r [entry-dev-unsigned.hap]`和`aa start`均成功，退出0，未重编/覆盖原staging产物或修改源码。

原18088专属H2/Web库保持运行和已完成验收。另在127.0.0.1:18089启动`smoke`、H2内存`portra_c_device_20261025`、demo种子关闭，加载**仓库现有**`backend/src/test/resources/schema-h2.sql`（`spring.sql.init.mode=always`、`schema-locations=file:...`），补齐MyBatis表，不改后端源码/原库；进程PID15512。复用原C opt-in HTTP脚本的scratch副本（仅替换loopback端口、专属库日志标记），退出0，正常验证码创建authorId1/reporterId2、momentId1（Feed3/详情5）、HTTP reportId1/PENDING，互动幂等与普通管理拒绝通过。这是设备测试数据准备，reportId1尚非鸿蒙提交。

端口转发为**设备18088→本机18089**：`hdc -t 127.0.0.1:5555 rport tcp:18088 tcp:18089`，返回OK；`fport ls`确认仅本轮映射。曾先建立设备18088→本机18088；带引号任务串移除未匹配，改用`fport rm tcp:18088 tcp:18088`成功后才建立新映射；未移除其他任务、开放主机公网接口或修改防火墙。

模拟器应用控制首次等待超时，之后用户已允许并成功读取实际页面；小艺输入法首次隐私提示交用户亲自处理，未代选。随后窗口最小化与工具“检测到手动操作，需先读状态”保护发生冲突，工具拒绝恢复/读取，已请用户仅还原窗口，不重复请求已有授权。登录后的设备验收仍在继续，不能提前标通过。

路由复核另发现：当前`AppRoute.HALL`仅有路由声明/标签及PageMap分支，未找到正常UI push或LOGIN returnRoute=HALL；之前交接称登录返回可进入HALL不准确，已在shared-change-requests纠正，并精确交公共导航维护者提供真实入口。C没有新造测试导航，也不把根内容设备结果套用到HALL。

## 公共依赖与真实跨端剩余项

| 项目 | 最新状态 / 负责人 |
| --- | --- |
| C-SHARED-07 | 官方 API26 模拟器 root 有效会话前台恢复、旧举报草稿清理、个人页返回及退出返回已验证；成功切身份缺合法双角色账号，HALL 缺正常 UI 入口。渲染旧 DTO 的真实失败已最小修复并在设备转绿，详见下文 |
| C-SHARED-03/04 | B/公共维护者尚未授权/提供修复；7项严格用例失败。shared-change-requests含精确兼容签名、插入位置与跨实例取消验收 |
| C-SHARED-01/02 | 公共ApiService点赞/详情方法仍缺；本地后端真实接口已测，不等于鸿蒙已接。未新增假按钮或完整相册 |
| C-SHARED-05/06 | B公开主页入口/真实作者资料待对齐；新增本地模拟器 C 收藏→B 收藏卡片→返回→取消收藏→B 空列表联动证据，保留原只读调用 |
| 签名/设备 | IDE、镜像、连接、staging及dev unsigned包安装/启动均已有实证；root部分路径与本地原生跨端闭环已通过。C-AUTH-01获授权修复后，本地API26冷启动/同包覆盖恢复及退出清理通过。成功切身份/HALL、实体设备、同签名升级和发布签名仍未验 |
| staging普通测试身份 | Web普通测试账号已合法登录并创建专用对象；原生短信登录与temp-staging代码契约不匹配，需维护者提供现有原生可用测试环境/认证方案，不能拿Web cookie替代 |
| Web管理员 | staging仍无现成合法管理员访问；用户随后授权的测试管理员仅创建在全新本地H2内存库，正常密码登录和本地Web闭环通过，未提权staging或重置既有密码 |

| X编号 | 状态 / 证据 |
| --- | --- |
| X01 鸿蒙举报 | **隔离本地官方模拟器通过**：2026-10-27 原生表单真实提交，reportId1/PENDING；不同于旧库的 HTTP reportId1，详见新增证据 |
| X02 Web查同一举报 | **本地通过**：Web 显示同一 reportId1、MOMENT1、唯一原因标记；staging 未验证 |
| X03 Web下架 | **本地通过**：Web 处理一次下架，动态 HIDDEN；鸿蒙正常重新登录后的有效会话 Feed 无该动态；staging 未验证 |
| X04 鸿蒙主动刷新/详情 | **本地原生 Feed 通过**：下架后重进不可见、恢复后刷新重新出现；鸿蒙详情公共方法仍缺，不能把此项扩展为详情验收 |
| X05 Web合法恢复 | **本地通过**：Web 动态管理独立 restore，鸿蒙重新请求可见；原举报仍 RESOLVED，未重复 resolve；staging 未验证 |
| X06 IGNORE | 未验证；不推断内容可见性 |
| X07 普通用户管理拒绝 | **隔离本地真实HTTP通过（40301）**；外部环境与设备未验证 |

独立审查无Critical，发现的HALL前台/shown时序Important已RED→GREEN修复；默认TODO与严格失败均按实际结果报告。未宣称C完整完成或具备首发验收条件。

## 原生会话与渲染回归（2026-10-26，2026-10-27续推核对）

使用官方 `Portra_C_API26`、HarmonyOS 7.0.0.107/API26、真实 Native LoginPage 和本地随机短信挑战完成登录。DevSmsSender 仅是本地短信传输，不代表运营商短信已验收；没有固定验证码、注入 token 或修改认证源码。

| 实际路径 | 观察及结论 |
| --- | --- |
| root 动态→我的→返回 | 输入未提交举报草稿 `C-LOCAL-C07-OLD-FORM`，进入真实 ProfilePage，再返回。旧对象、表单及输入消失，真实列表重新出现 |
| root 动态→我的→切摄影师→返回 | ProfilePage 显示 userId3/CUSTOMER；实际切换返回“当前账号没有权限执行此操作”。仅证明拒绝路径和返回清理，**成功切身份未验证**，未改角色绑定 |
| root 动态→我的→退出→返回 | 修复包正常退出后直接回 root，仅登录提示；无旧列表、举报对象和输入。[截图](evidence/20261027/root-logout.png) |
| root 后台→前台，有效会话 | 实际系统 Home 后，在普通作者会话只修改本地测试动态标题，再 `aa start` 恢复。PID 前后同为12404；热门筛选保留，显示新标题 `C修复后前台重读-20261026`，旧举报及 `C-LOCAL-FOREGROUND-OLD-FORM` 消失。[截图](evidence/20261027/root-foreground.png) |
| C收藏→B个人页→返回→取消收藏→B个人页 | C 实际显示已收藏1，B 重新读取同一动态且以原只读 MomentCard 显示收藏1；返回 C 后取消收藏为0，B 再进入显示收藏空列表。未改 B 源码 |
| HALL destination | 仍缺正常 UI 进入调用，**上述 root 结果不套用到 HALL**；详见公共交接 |

先前一次恢复进入游客：后端默认 access token 为15分钟，原操作已跨过有效期；公共 HttpClient 在401后清会话。该结果未算有效会话重读通过。重新正常登录后的测试另复现真实渲染问题：后台修改后，HTTP热门Feed已是新标题，原生恢复及手动刷新仍显示旧标题；切空频道再回来才更新。

原因是 C `ForEach` 仅以 momentId 为键，保留同 ID 的旧 DTO/回调。按[官方 ForEach 组件创建规则](https://github.com/openharmony/docs/blob/master/zh-cn/application-dev/ui/rendering-control/arkts-rendering-control-foreach.md#非首次渲染)，C 页改用视图版本及 DTO 内容生成键；B 的卡片调用和 props 未改。新键行为测试先因“server replacement must repaint”失败，再修复转绿，随后真实同进程前台恢复通过。

独立审查又发现：举报展开时收藏同一动态会改变 DTO 键，重建整个举报行并丢草稿。已先补两项失败行为测试，再在 C 内加入互斥：举报打开期间该行收藏禁用且方法不发请求；收藏在途时举报入口及排队回调被拦截；其他行收藏仍可执行，关闭举报后收藏恢复。未修改 ReportPanel 或请求层；复核无新的 Critical/Important。此保护不修复共享表单原有的7项缺口。

## 本地原生＋Web同一举报闭环（2026-10-27）

中断后检查确认旧本地进程已停止，H2内存数据已释放，故以新库 `portra_c_admin_20261027` 重启。**本段编号不能与2026-10-25/26旧库同号记录串联。** 所有数据均为本轮普通测试身份及一次性测试内容。

- 后端来源：既有后端构建及已授权的 scratch 空库夹具，smoke、demo种子关闭、仅127.0.0.1:18088；加载仓库原有 `schema-h2.sql` 补 MyBatis 表。空库中仅初始化本地测试管理员，既有普通账户未提权、未重置密码。
- Java17首次启动在 IpLocationService 初始化时因 Selector loopback失败；最小探针以进程级 `java.net.preferIPv4Stack=true` / `jdk.net.unixdomain.tmpdir` 对照通过后，原夹具重启成功。仅进程参数，未改全局JDK、系统网络、安全设置或共享配置。
- Web来源：原 C 工作区现有 Web，进程 `VITE_API_BASE_URL=http://127.0.0.1:18088`，仅127.0.0.1:15173。设备映射仅 `tcp:18088→tcp:18088`。两端均实测可连通；这是用户授权的**本地测试环境**，不是团队确认的staging认证方案。
- Windows浏览器窗口通道两次因无法确认URL结束。改用内置浏览器直接识别 `http://127.0.0.1:15173/login/admin`，再通过原登录表单正常登录成功；没有关闭安全检查、注入Web会话或修改登录实现。凭据、验证码、原始日志、夹具均不提交。

| 顺序 | 实际行为与证据 |
| --- | --- |
| 1 | 普通作者2经正常短信登录发布 `C-NATIVE-20261027-TEST-ONLY`，momentId1、完整5图、Feed预览3图；准备脚本未创建举报 |
| 2 | 鸿蒙原生账号3在现有 ReportPanel 输入 `C-NATIVE-20261027-LOCAL-TEST-ONLY`，仅提交一次，页面显示“举报已提交”。[截图](evidence/20261027/native-submitted.png) |
| 3 | 同一普通账号正常登录，仅GET `/reports/my`，查到唯一 reportId1/MOMENT1/PENDING；Web举报队列显示同一ID和原因。[记录](evidence/20261027/native-report-record.json)、[Web截图](evidence/20261027/web-report-1.png) |
| 4 | Web对该PENDING举报执行一次“下架内容”，填写测试原因；动态管理显示No.000001 HIDDEN。[Web截图](evidence/20261027/web-hidden.png) |
| 5 | 鸿蒙首次刷新因会话过期进入登录提示，该结果未算通过。随后通过真实原生短信正常登录，Feed显示“暂时没有已发布的动态”，无旧举报和测试标题；设备UI断言退出0。[有效会话截图](evidence/20261027/native-hidden.png) |
| 6 | Web在 `/admin/feed` 使用独立“恢复展示”，填写恢复原因，显示VISIBLE；未在举报队列再次resolve。[Web截图](evidence/20261027/web-restored.png) |
| 7 | 鸿蒙有效会话点击刷新，真实列表重新显示同一标题/ID及预览3图，断言退出0。[截图](evidence/20261027/native-restored.png) |
| 8 | 普通用户再正常登录，仅GET核对原举报仍为RESOLVED。[记录](evidence/20261027/native-report-after-restore.json) |

没有用作者删除/新建代替下架恢复；没有承诺实时推送；鸿蒙详情未接入，完整5图的HTTP读取不能替代原生详情验收。该本地闭环也不能替代staging的合法原生认证、管理员访问、成功切身份、HALL及真机签名验收。

### 当前自动验证

工作区为C独立工作区。Node使用DevEco自带版本，`DEVECO_SDK_HOME=C:\Program Files\Huawei\DevEco Studio\sdk`；完整输出仅在本机scratch，表中保留实际命令与退出码。

| 检查 | 命令 | 退出码 / 结果 |
| --- | --- | --- |
| 行复用RED | `node --test --test-name-pattern=same-ID harmony/tests/moment-feed-behavior.test.cjs` | 1，原键无法区分服务器替换 |
| 举报/收藏互斥RED | `node --test --test-name-pattern='report draft\|queued report' harmony/tests/moment-feed-behavior.test.cjs` | 1，两项实际断言失败；修复后并入全套 |
| C修复交付时全套 | `node --test harmony/tests/*.test.cjs` | **0，105项：98通过、7 TODO、0跳过**；随后增加C-AUTH-01交接契约，最新107项结果见后文 |
| 共享举报严格模式 | `PORTRA_REQUIRE_SHARED_REPORTS=1; node --test harmony/tests/moment-report-contract.test.cjs` | **1，9项：2通过、7失败**；仍待B/公共维护者 |
| 本地准备 | `node [scratch]/harmony-c-20261027/prepare.cjs` | 0，正常短信发布一条测试动态，未创建举报 |
| 原生提交记录只读核对 | `node [scratch]/verify-native-report.cjs`；恢复后 `node [scratch]/verify-native-report-after-restore.cjs` | 首轮均0，唯一PENDING→原记录RESOLVED，不重提/重处理；后续追加决策字段核对入口短信返回40001、退出1，未进入GET也未重试，保留此前实际RESOLVED记录 |
| 原生下架/恢复断言 | 官方Emulator `-uiLayout -i` / `-click` 与设备截图，读取UI断言 | 均0；不是Node手调生命周期 |
| 最终dev构建 | harmony目录、进程`PORTRA_BASE_URL=http://127.0.0.1:18088`，DevEco自带`hvigorw.bat assembleHap --no-daemon -p product=dev` | **0，18.225秒，33 tasks：17执行/16 up-to-date**；未配置签名，不是发布包 |
| 最终包安装/启动 | `hdc -t 127.0.0.1:5555 install -r [entry-dev-unsigned.hap]`；`shell aa start -b com.portra.app -a EntryAbility` | 均0；原生正常重新登录后真实Feed可见 |
| 最终包草稿保护 | 设备真实`uitest dumpLayout`属性、点击和UI断言 | 0；同条收藏`enabled=false/clickable=false`；点击后草稿与收藏0不变；关闭后真实收藏恢复为1，无新举报 |

最终HAP路径为`harmony/entry/build/dev/outputs/dev/entry-dev-unsigned.hap`，SHA256 **`BDF408F49EBA0C853ABBAA7B25359CC376B8C1F5AC572AC831DB0A449AE8C743`**，包不提交。原生＋Web完整链路先在行复用修复包（SHA256 `09E543AD30CED8110F2010FDD578E191427D75B389F3B117664570B96B4ED55E`）验证；随后独立审查增加同条草稿互斥，以上最终包已重新构建、安装并完成有效会话Feed及草稿保护/关闭后收藏的设备验证。[最终Feed](evidence/20261027/final-package-feed.png)、[草稿保护](evidence/20261027/final-draft-protected.png)、[真实设备属性](evidence/20261027/final-draft-guard-state.json)、[关闭后收藏](evidence/20261027/final-favorite-after-close.png)。

上述BDF408...历史包覆盖安装后曾进入游客提示，只读定位为公共安全存储作用域不匹配；不能把当时重新登录算恢复通过。末尾C-AUTH-01记录随后获授权修复及新最终包的真实恢复/清理结果。模拟器接受unsigned包仍不代表实体设备和发布签名已就绪。

当前行键包含DTO序列化及内联图片；本轮以合成五图测试对象验证行为，大图/长Feed的性能尚未专项验收，不能据此宣称已完成性能验收。

2026-10-27最新公共核查：SSH fetch被本机网络关闭；单次进程级HTTPS重写后fetch退出0，未改Git共享配置。`origin/integration/harmony-v1`仍为 `b258ec8114ac1ff8f360099155f5d284f1247c41`，未发现所需公共/B修复；关联依赖修复PR/SHA仍无。PR25仍OPEN/Draft、base仍唯一integration/harmony-v1。尚未解决的C-SHARED-01/02/03/04/05、HALL正常入口和合法双身份测试流程继续按shared-change-requests交接，不自动合并。

## C-AUTH-01：持久会话恢复定位、授权修复与真实验收（2026-10-27续推）

在原本地测试服务/官方API26模拟器上，正常原生登录后不到一分钟，既不登出也不覆盖安装，仅冷启动即进入guest。临时C诊断显示guest/version1、存储错误none/code0；这不能直接解释为资产丢失。后端正常HTTP短信登录→真实native refresh→正常退出对照退出0，轮换成功，凭据未输出。

进一步只查Asset ATTRIBUTES：正常登录状态下，按公共代码相同别名、省略REQUIRE_ATTR_ENCRYPTED，重复得到24000002；仅把临时属性查询设为true，不重新登录即得到原记录数量1。`AssetCredentialStore.save()`已经设true，而`load()`与`clear()`漏传。官方query/remove均默认false，作用域不一致解释了读取被当作NOT_FOUND及删除未命中。标记描述附属信息加密范围，不代表另一范围的SECRET明文存储。[设备证据与边界](evidence/20261027-auth/README.md)。

先完成[两行可审阅补丁](proposals/asset-credential-store-encrypted-scope.patch)，适用性检查退出0；新增`moment-auth-storage-contract.test.cjs`补足native边界分区语义，原实现严格2失败/退出1，内存候选2通过/退出0。随后用户明确回复“已获维护者授权，应用补丁并验收”，仅在真实公共load/clear的ALIAS后各加true，不更改save、方法签名、命名空间、登录、网络或DTO。独立只读复核无Critical/Important。

契约已移除内存候选替换与认证TODO，直接执行真实源码。`node --test harmony/tests/auth.test.cjs harmony/tests/moment-auth-storage-contract.test.cjs`：**退出0，12/12通过**。`node --test harmony/tests/*.test.cjs`：**退出0，107项100通过、7既有举报TODO、0跳过**。读取、删除、重复删除及不同环境隔离均通过；共享举报严格结果仍2过7失败，不能称全要求已通过。

真实API26模拟器：观察包直接恢复此前已存在的用户3加密凭据，无新短信；force-stop/start和同一包覆盖安装仍显示同一真实Feed/收藏1。正常退出后只读加密属性查询为24000002，再冷启动仍游客，确认真实清理。随后将临时C诊断源码精确恢复到c803e85；最终包用正常随机短信登录后，冷启动PID461→1003、同一产物覆盖安装均无需短信恢复Feed/收藏；正常退出后再次冷启动仅登录提示。共10次实际UI断言退出0。没有注入token、读取设备SECRET、重提举报或重复处理原reportId。

最终构建：进程`PORTRA_BASE_URL=http://127.0.0.1:18088`，harmony目录执行`hvigorw.bat assembleHap --no-daemon -p product=dev`，**退出0，15.412秒，33 tasks（17执行/16 up-to-date）**。最终HAP SHA256 **`318E4AF5BC3F8D1C8877398F928F9BFC7B9EA134303687DE5D58A9C7BC94675B`**，无临时诊断；install/start退出均0。覆盖后首帧尚无入口的UI断言曾退出1，重新实际读取大厅再点击通过，记录为采集时序而非隐藏失败。全部[设备截图、UI树及边界](evidence/20261027-auth/README.md)。

C-AUTH-01已解除本地API26恢复/清理缺口；同签名版本升级、实体设备、发布签名、锁屏访问控制、长时间令牌过期与staging仍未验收。跨环境不互删是实际源码契约证据，未冒称双环境设备实测。其他公共文件边界不变；C-SHARED-01/02/03/04/05、成功切身份、HALL真实入口与外部完整验收仍未完成，PR25保持Draft。
