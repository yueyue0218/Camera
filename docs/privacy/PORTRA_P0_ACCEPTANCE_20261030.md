# Portra 两项 P0 任务交付与验收依据（2026-10-30）

本次完成定位授权与摄影师需求意向、个人信息权利与账号注销、香港出境同意生命周期的源码实现。后端使用真实数据库实体、事务、权限校验和接口；没有用本地状态、退出登录或模拟数据代替后端操作。数据库迁移尚未执行、后端未部署、设备未验收，因此端到端功能尚不能标为全部 PASS，也不能据此宣称满足上架审核。

## 1. 基线、工作树与保护

- 指定分支：`feature/harmony-c-ui-polish`。
- 最终目标工作树：`C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera`。
- 同步前目标 HEAD：`99609d327330f5a523e34247dbf55ba91c9a2445`，目标工作树干净。
- 已执行 `git fetch origin feature/harmony-c-ui-polish` 和 `git merge --ff-only origin/feature/harmony-c-ui-polish`。
- 同步后及本次代码修改前/后 HEAD：`9ed26b22c050fa4d07f9205d8ec0b554dcd08c8b`。本次功能改动未暂存、未 commit、未 push。
- 原 `C:/Users/LiXiaozhou/Camera` 在 `preview/harmony-c-ui-polish`，HEAD `131854e4c89358905bb2f897d518842aeece7839`；原有前端、通知、大厅等未提交改动均保留。
- 已检查目标及其父路径规范，未发现适用的 AGENTS.md。附件里的 D:/software/Camera 为历史路径，以本机真实 worktree 为准。
- 为遵守写入边界，先用同步后的 Git archive 在 `Camera/output/portra-p0-20261030/source` 实现及验证，交付时逐文件校验目标分支、HEAD 和原内容，再写回目标工作树。没有覆盖其他工作树。
- 当前本机 worktree 列表未发现附件所述 `output/portra-p0-integration-20261030`，没有猜测或改动该历史集成树。当前主预览树与目标在隐私目录及 AppClient 无已提交差异，Index/Profile 的最新变化已以目标远端为基线集成。
- 未部署服务器、写生产数据库、安装/卸载应用、清除设备数据、修改签名或华为已上传协议。

## 2. 定位与需求意向验收表

| 项目 | 状态 | 代码和真实验证证据 |
|---|---|---|
| 系统授权弹窗 | PARTIAL | 正式 requestPermissionsFromUser、UIAbilityContext、authResults 和永久拒绝设置引导已实现；12项定位主机行为测试通过，真实系统弹窗待设备 |
| 系统定位 | PARTIAL | 先查系统开关，再检查/申请前台粗略权限，实际 getCurrentLocation；未读取本机模拟器坐标，不虚构结果 |
| 逆地理编码 | PARTIAL | 检查 isGeocoderAvailable，实际 getAddressesFromLocation，ProvinceCatalog 规范化；设备省市或错误码待验收 |
| 主页地区同步 | PARTIAL | 复用 ProvinceLocation.observe/cached/label，大厅省级筛选、主页省市显示；实际UI观察待设备 |
| 摄影师意向入口 | PARTIAL | 原个人主页紧凑双卡中摄影师也显示我的意向；尺寸/圆角/字体/间距沿用原卡，客户入口保留；设备视觉待验收 |
| 需求星星真实接口 | PARTIAL | GET/POST/DELETE /demands/{id}/interest；复用 service_package_interests，真实H2持久化通过，待迁移部署 |
| 加入/取消意向 | PARTIAL | 服务端确认后才变星，幂等及数据库唯一性；12并发请求只产生同一记录；真实服务环境端到端待验收 |
| 需求意向列表 | PARTIAL | GET /me/demand-interests 真实数据库分页；关闭只读、隐藏/删除安全降级，角色/账号隔离测试通过，待部署设备 |
| 前端构建 | PASS | 最终 Debug HAP 与未签名 staging Release HAP 均 BUILD SUCCESSFUL |
| 后端测试 | PASS | 271项，失败0，错误0，跳过0；进程超时300秒，日志backend-p0-regression.log。 |

定位仅声明并使用 `ohos.permission.APPROXIMATELY_LOCATION`。本机 SDK26 的 getCurrentLocation 声明要求该粗略权限；没有新增精准、后台或持续定位。缓存仅为内存省市信息，10分钟失效，不缓存/上传精确经纬度、不自动对其他用户公开。定位与主页首帧异步解耦。

回归发现远端原有 ProvinceNames 把多个城市别名拼成字面量的竖线字符串，导致定位后按江苏筛选漏掉南京/苏州历史数据；本轮仅修正同一省份兼容映射，与现有 ProvinceCatalog 保持对应，补充规范化/精确旧城市查询测试并运行原需求和橱窗分页测试；查询及分页结构沿用原实现。

模拟器证据目前均为「待设备读取」：系统定位开关、应用 authResults/dialogShownResults/errorReasons、是否获取有效坐标、逆地理编码支持及结果、失败阶段/错误码。可在调试器读取 `ProvinceLocation.diagnostics()`；UiPerf 日志按阶段记录，不含坐标或身份。没有把模拟器逆地理编码失败猜成已知事实。

需求意向 API 只允许当前摄影师操作本人意向；公开有效需求可新增，关闭历史可保留只读；删除、隐藏或撤回出境同意而不可见的目标返回 `UNAVAILABLE` 且 `demand=null`，不泄露标题、预算、作者、图片。意向不创建订单、不发消息、不发起咨询。原星星尺寸和颜色没有重做。

## 3. 个人信息权利与注销实现

| 能力 | 当前真实实现 | 运行验收 |
|---|---|---|
| 隐私与授权管理 | 我的→设置→隐私与授权管理；复用三份协议，查询服务端香港授权，二次确认后PUT撤回；事件审计和下线限制同一事务 | 主机/后端测试见下，待部署设备 |
| 权利申请 | 我的→设置→个人信息权利申请；查询/复制/更正/删除共用表单，账号绑定、持久化、幂等key、分页状态与反馈 | 删除仅显示申请已提交，实际内容处理由核验后的运营执行 |
| 注销账号 | 我的→设置→注销账号；独立REAUTH短信、二次确认；真实终止账号、匿名化、会话和Refresh撤销、旧凭据拒绝 | 未完成约定/争议/管理员身份阻断；短信获准配置及设备联调待完成 |

运营受理已有真实可用的 `GET /admin/privacy-rights` 队列和 `PATCH /admin/privacy-rights/{id}`：SUBMITTED→PROCESSING→COMPLETED/REJECTED；完成必须记录身份核验与处理范围，拒绝必须说明理由；真实ADMIN绑定校验，结果在本人申请列表可查并进入既有审计。没有新增运营Web页面。具体字段、请求样例、REAUTH模板和受限保留说明见同目录 `P0_PRIVACY_OPERATOR_RUNBOOK_20261030.md`。

注销复用原账号治理cleanup；User不做DELETE CASCADE。手机号密文/哈希/脱敏值、密码、昵称之外的资料及摄影师个人资料清理/匿名化；全部会话撤销；需求/橱窗下线隐藏、动态逻辑下线、公开文件转PRIVATE、公开照片授权撤销；关注/意向/本人互动、通知等辅助记录清理。消息、约定、订单、评价、举报、审计及关联证据受控保留，不宣称物理图片和备份已删除。已有设备/浏览器缓存不能由服务器远程回收。

注销短信采用获准的独立 `camera.sms.reauth-template-id`；PNVS还要求与登录不同的 `camera.sms.reauth-scheme-name`。缺配置时真实失败，不能把登录验证码或登录模板拿来模拟注销成功。当前不会自动配置ECS或发送真实短信。

## 4. 出境同意完整生命周期

| 场景 | 主机/后端代码验证 | 最终设备/部署验收 |
|---|---|---|
| 首次未同意 | 网络门禁阻止大厅、登录、文件及上传；不提前创建安装ID；协议本地展示 | 待设备抓包 |
| 主动同意 | 两份协议独立默认不选；本地类型/版本/时间/状态/安装主体；登录后显式绑定真实账号记录 | 待设备 |
| 拒绝 | 记录DENIED、当时版本和时间，不造ID、不开放业务；可读协议/权利联系渠道 | 待设备 |
| 重新同意 | 只有新的显式勾选才可覆盖WITHDRAWN；服务端拒绝旧时间重放 | 待部署设备 |
| 重启应用 | 持久化本地门禁，恢复身份后先查询服务端；旧pending不自动覆盖远端撤回 | 待设备 |
| 退出/重新登录 | 账号代际隔离；登录后先同步授权再进入业务；旧响应不能修改新账号 | 待设备 |
| 撤回 | 先暂停新业务、取消可取消HTTP、移除远程图片节点；服务端事件和限制同事务；保留必要权利入口 | 待部署设备 |
| 撤回失败 | 不显示成功、不注销账号模拟成功；业务保持暂停，允许核实状态与重试 | 待故障注入设备 |
| 并发请求 | 每次请求及认证重试前复查；40302取消在途HTTP；图片与定位也复查门禁 | 已进入服务端的业务事务仍需并发部署验收，见风险 |
| Release一致性 | staging Release字节码含全部核心模块，哈希见下；不是用旧Debug替代 | 最终production地址、签名、正式包及真机待验收 |

仅允许必要隐私请求及必要认证恢复继续访问；主动使用权利渠道时会说明身份核验和申请处理。普通登录、消息、约拍等本机撤回后被拦截。另一设备已经撤回而本机尚未知晓时，必要认证后读取账号决定，不能静默恢复普通业务。未记录同意的历史Web客户端保留原兼容行为，不能将Harmony门禁描述为全平台首次同意改造。

## 5. 华为第六章填写依据（部署和设备验收前为待验收）

| 华为条款 | 准确应用入口 | 个人信息种类/后端能力 | 状态 |
|---|---|---|---|
| 6.1 信息访问 | 我的→设置（查看本人资料）；我的→设置→个人信息权利申请→申请查询/复制个人信息 | 昵称、头像、简介、地区、个人可见字段及申请指定范围；现有本人资料接口+新增持久化申请/运营反馈 | 待验收 |
| 6.2 信息更正 | 我的→设置（现有资料编辑）；我的→设置→个人信息权利申请→申请更正个人信息 | 本人可编辑资料直接更正，其他指定信息核验后人工处理 | 待验收 |
| 6.3 信息删除 | 我的→设置→个人信息权利申请→申请删除个人信息 | 资料、图片、公开内容及申请涉及记录；身份核验、受理和反馈，保留范围分别审查 | 待验收 |
| 6.4 撤销同意 | 我的→设置→隐私与授权管理→撤回中国香港数据出境同意 | 授权类型/协议版本/时间/账号与安装主体；服务端撤回审计、请求拦截和公开数据限制 | 待验收 |
| 6.5 注销服务 | 我的→设置→注销账号→短信核验→再次确认并注销账号 | 账号认证和资料匿名化、会话撤销、关联内容受控处理 | 待验收 |

可在完成部署及设备验证后采用的简短说明（当前不可当作已上线承诺）：

> 您可通过“我的→设置”查看、编辑个人资料，通过“个人信息权利申请”提出查询、复制、更正或删除申请并查看反馈；通过“隐私与授权管理”查看协议及撤回中国香港数据出境同意。撤回后依赖该同意的业务暂停，必要权利渠道仍可使用。您可通过“注销账号”核验绑定手机号并再次确认后终止账号服务。相关个人资料将删除或匿名化，涉及其他用户权益或需要保留的记录将分别受控处理。删除申请的提交不等于删除已经完成。联系邮箱：3336578810@qq.com。

未自动修改 `LegalDocumentContent.ets` 或华为后台协议。需运营核实/修订：当前“境外接收方”写阿里云计算有限公司并注明以购买协议为准，真实签约接收主体、地域、联系人和联系方式仍需用合同核对；不要编造。现有政策列出的日志/证件/聊天/订单/照片/备份固定期限，不能据本轮代码承诺已有自动到期清理；应核实清理任务及人工留存能力。第六章入口应与本表一致，并明确人工申请和直接注销的不同处理。

技术实现不代表全部出境义务完成；运营仍需核实个人信息保护影响评估、适用出境程序、供应商协议及保存/限制处理依据。参考[《个人信息保护法》官方文本](https://www.miit.gov.cn/jgsj/zfs/fl/art/2022/art_515a4b20c12f430eab54bb4f56d89f56.html)，本报告不替代对实际业务的合规审查。

## 6. 测试、构建及证据

- 前端：`$env:DEVECO_SDK_HOME='C:/Program Files/Huawei/DevEco Studio/sdk'; node --test --test-timeout=30000 harmony/tests/*.test.cjs`，491/491 PASS，0失败/跳过。
- 需求意向真实数据库：`mvn test -B -Dtest=DemandInterestPersistenceTest -Dsurefire.forkedProcessTimeoutInSeconds=180`，6/6 PASS；包括12并发加入、数据库唯一约束、分页、角色隔离、删除/隐藏及两种意向隔离。
- 后端最终回归：271项，失败0，错误0，跳过0；进程超时300秒，日志backend-p0-regression.log。
- Maven首次在沙箱内编译测试时不能枚举已有class；沙箱外运行已解决。本机JDK的Unix socket临时目录导致回环初始化失败，最终测试命令设置进程级 `JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=C:/Users/LiXiaozhou/Camera/.tmp/p0-java-sockets` 并使用支持PATCH的 `-Dspring.http.client.factory=jdk`，不修改生产HTTP配置。隐私首跑两处断言未计入@Repository异常翻译，已改成DataAccessException并核验根因，保留真实事务回滚断言；以最终日志为准。
- Debug：`hvigorw.bat assembleHap --no-daemon -p product=dev -p buildMode=debug`，BUILD SUCCESSFUL，未签名。
- Release：`hvigorw.bat assembleHap --no-daemon -p product=staging -p buildMode=release`，BUILD SUCCESSFUL，复用现有本地环境配置，未签名；未访问或部署staging服务。
- 两个HAP的`.abc`均检出 PrivacySettingsPage、PrivacyRequestGuard、X-Portra-Consent-Version、account-closure、DemandInterestList、ProvinceLocation，未以源码存在代替包内核验。
- 原始日志位于 `C:/Users/LiXiaozhou/Camera/output/portra-p0-20261030/`：`source/harmony-tests.log`、`source/harmony-build-debug.log`、`source/harmony-build-staging-release.log`、`source/build-evidence.json`、`source/demand-interest-test-unsandboxed.log`、`backend-p0-regression.log`。
- 变更清单、可审阅补丁、工作区状态和差异检查：同目录 `change-manifest.json`、`portra-p0.patch`、`git-status.txt`、`git-diff-stat.txt`、`git-diff-check.txt`。

### 包哈希

- `entry-dev-unsigned.hap`：`00592f13fe14456641baef1e9b087f3d3e44df1c6c62564bc0153dcbd9f2b18e`。
- `entry-staging-unsigned.hap`：`fe31d672990364f40f801ccf8ecc94ebb97979dbe1921ad81f44d026e8545e48`。

## 7. 必须执行的人工验收

1. 新装/未授权启动抓包：勾选前无业务HTTP、图片、登录请求；三份协议可读，权利联系渠道可用。
2. 独立主动同意/拒绝/重启/再次同意/退出重登，核对本地与服务端版本、主体、状态和事件。
3. 系统定位总开关关闭、首次未授权、允许、拒绝、永久拒绝设置引导分别测试；保留手动选省。
4. 记录模拟器或真机diagnostics的开关、授权、坐标阶段、逆地理编码阶段和错误码；成功省市同时更新大厅和主页。
5. 摄影师公开需求星星→数据库保存→主页我的意向→原详情→取消→刷新消失→退出重登状态正确；检查客户橱窗意向及切换角色不串页。
6. 关闭历史需求只读；删除/隐藏/失去权限显示安全占位而不泄露原内容，仍可移出意向。
7. 查看当前服务端香港授权，二次确认撤回；核对数据库事件、公开内容下线及新HTTP/图片/定位停止；权利申请仍可用。
8. 撤回请求失败/超时、并发请求、另设备撤回及旧设备重启，不显示假成功、不自动恢复授权；重新同意不自动恢复公开内容。
9. 提交删除申请，数据库真实持久化；本人查状态、他人不可查；运营受理、身份核验、实际处理后反馈或给出拒绝理由。
10. 配置独立获准REAUTH短信；绑定手机号错误、验证码错误/过期、未完成约定及二次确认取消分别测试，失败不注销。
11. 成功注销后核对账号匿名化、内容下线、全部旧Access/Refresh失效；返回/离开/重复点击不伤及新登录账号。
12. 确认production origin、既有签名及最终Release包，再对同一个包做真机、抓包和视觉验收；本轮staging未签名包不能代替最终上架验收。

## 8. 剩余风险与未承诺事项

- 两份迁移仅提交可审核SQL，尚未在隔离MySQL或线上执行；H2测试不替代MySQL迁移演练。遵守先测试、再由用户决定是否部署；本轮禁止自动部署。
- 需要真实短信模板/独立scheme配置、正式服务地址和签名；不编造可收短信或已满足华为审核。
- 查询/复制/更正/删除申请由运营人工核验和实际交付；有真实API队列但没有新增Web管理页、自动导出、自动物理删除或自动备份清理。
- 服务端在请求开始时拦截WITHDRAWN，客户端取消可取消的在途请求；已通过鉴权并在服务端执行的不同业务事务仍需部署前并发联调，不能承诺跨业务的全局事务撤销。已传输、已完成或依法需留存的数据按运营清单限制处理。
- 历史Web首次同意兼容边界、图片设备缓存、原文件/备份保存期限及恢复公开内容流程均需运营落实。重新授权不自动恢复已下线内容。
- 境外接收方合同主体及个人信息保护影响评估/其他适用程序尚待人工核实。当前状态不等于华为审核通过或全部上架条件已满足。

## 9. 修改文件、目的、主要行号与增删行

以下路径相对于目标工作树。主要行号为本次第一个变更块的当前行号；新增文件从第1行起。完整变更与精确哈希见change-manifest.json。设备/签名/部署配置未改。

| 文件 | 主要行号 | 增/删 | 目的 |
|---|---:|---:|---|
| [backend/src/main/java/com/action/camera/account/repository/AccountCancellationCleanupRepository.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/account/repository/AccountCancellationCleanupRepository.java:42) | 42 | +8/-0 | 核验注销、会话撤销和受控数据处理 |
| [backend/src/main/java/com/action/camera/account/repository/AccountCancellationRequestRepository.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/account/repository/AccountCancellationRequestRepository.java:19) | 19 | +4/-0 | 核验注销、会话撤销和受控数据处理 |
| [backend/src/main/java/com/action/camera/account/service/AdminAccountCancellationService.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/account/service/AdminAccountCancellationService.java:100) | 100 | +2/-1 | 核验注销、会话撤销和受控数据处理 |
| [backend/src/main/java/com/action/camera/account/service/SelfAccountClosureService.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/account/service/SelfAccountClosureService.java:1) | 1 | +73/-0 | 核验注销、会话撤销和受控数据处理 |
| [backend/src/main/java/com/action/camera/auth/config/SmsProperties.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/auth/config/SmsProperties.java:31) | 31 | +4/-0 | 注销REAUTH用途隔离，保持登录流程 |
| [backend/src/main/java/com/action/camera/auth/service/PhoneSmsService.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/auth/service/PhoneSmsService.java:149) | 149 | +1/-1 | 注销REAUTH用途隔离，保持登录流程 |
| [backend/src/main/java/com/action/camera/auth/sms/SmsCloudVerifier.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/auth/sms/SmsCloudVerifier.java:7) | 7 | +7/-0 | 注销REAUTH用途隔离，保持登录流程 |
| [backend/src/main/java/com/action/camera/auth/sms/aliyun/AliyunSmsSender.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/auth/sms/aliyun/AliyunSmsSender.java:34) | 34 | +5/-2 | 注销REAUTH用途隔离，保持登录流程 |
| [backend/src/main/java/com/action/camera/auth/sms/dypns/DypnsSmsSender.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/auth/sms/dypns/DypnsSmsSender.java:58) | 58 | +21/-4 | 注销REAUTH用途隔离，保持登录流程 |
| [backend/src/main/java/com/action/camera/common/ErrorCode.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/common/ErrorCode.java:28) | 28 | +2/-1 | 本次必要接线与访问控制 |
| [backend/src/main/java/com/action/camera/common/config/WebMvcConfig.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/common/config/WebMvcConfig.java:4) | 4 | +6/-1 | 本次必要接线与访问控制 |
| [backend/src/main/java/com/action/camera/common/region/ProvinceNames.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/common/region/ProvinceNames.java:53) | 53 | +56/-56 | 定位省份与历史城市别名兼容，修复定位后漏匹配 |
| [backend/src/main/java/com/action/camera/demand/controller/DemandInterestController.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/demand/controller/DemandInterestController.java:1) | 1 | +35/-0 | 复用意向业务，摄影师需求目标与分页 |
| [backend/src/main/java/com/action/camera/demand/dto/DemandInterestDto.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/demand/dto/DemandInterestDto.java:1) | 1 | +8/-0 | 复用意向业务，摄影师需求目标与分页 |
| [backend/src/main/java/com/action/camera/demand/service/DemandInterestService.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/demand/service/DemandInterestService.java:1) | 1 | +112/-0 | 复用意向业务，摄影师需求目标与分页 |
| [backend/src/main/java/com/action/camera/demand/service/DemandService.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/demand/service/DemandService.java:312) | 312 | +1/-1 | 本次必要接线与访问控制 |
| [backend/src/main/java/com/action/camera/privacy/controller/AdminPrivacyRightController.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/privacy/controller/AdminPrivacyRightController.java:1) | 1 | +21/-0 | 授权生命周期、权利申请与处理控制 |
| [backend/src/main/java/com/action/camera/privacy/controller/PrivacyController.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/privacy/controller/PrivacyController.java:1) | 1 | +38/-0 | 授权生命周期、权利申请与处理控制 |
| [backend/src/main/java/com/action/camera/privacy/domain/PrivacyConsent.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/privacy/domain/PrivacyConsent.java:1) | 1 | +19/-0 | 授权生命周期、权利申请与处理控制 |
| [backend/src/main/java/com/action/camera/privacy/domain/PrivacyConsentEvent.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/privacy/domain/PrivacyConsentEvent.java:1) | 1 | +19/-0 | 授权生命周期、权利申请与处理控制 |
| [backend/src/main/java/com/action/camera/privacy/domain/PrivacyRightRequest.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/privacy/domain/PrivacyRightRequest.java:1) | 1 | +23/-0 | 授权生命周期、权利申请与处理控制 |
| [backend/src/main/java/com/action/camera/privacy/dto/PrivacyDtos.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/privacy/dto/PrivacyDtos.java:1) | 1 | +28/-0 | 授权生命周期、权利申请与处理控制 |
| [backend/src/main/java/com/action/camera/privacy/repository/PrivacyConsentEventRepository.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/privacy/repository/PrivacyConsentEventRepository.java:1) | 1 | +4/-0 | 授权生命周期、权利申请与处理控制 |
| [backend/src/main/java/com/action/camera/privacy/repository/PrivacyConsentRepository.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/privacy/repository/PrivacyConsentRepository.java:1) | 1 | +4/-0 | 授权生命周期、权利申请与处理控制 |
| [backend/src/main/java/com/action/camera/privacy/repository/PrivacyProcessingRestrictionRepository.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/privacy/repository/PrivacyProcessingRestrictionRepository.java:1) | 1 | +20/-0 | 授权生命周期、权利申请与处理控制 |
| [backend/src/main/java/com/action/camera/privacy/repository/PrivacyRightRequestRepository.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/privacy/repository/PrivacyRightRequestRepository.java:1) | 1 | +15/-0 | 授权生命周期、权利申请与处理控制 |
| [backend/src/main/java/com/action/camera/privacy/service/PrivacyConsentService.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/privacy/service/PrivacyConsentService.java:1) | 1 | +87/-0 | 授权生命周期、权利申请与处理控制 |
| [backend/src/main/java/com/action/camera/privacy/service/PrivacyRequestInterceptor.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/privacy/service/PrivacyRequestInterceptor.java:1) | 1 | +46/-0 | 授权生命周期、权利申请与处理控制 |
| [backend/src/main/java/com/action/camera/privacy/service/PrivacyRightService.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/privacy/service/PrivacyRightService.java:1) | 1 | +97/-0 | 授权生命周期、权利申请与处理控制 |
| [backend/src/main/java/com/action/camera/servicepackage/domain/ServicePackageInterest.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/servicepackage/domain/ServicePackageInterest.java:23) | 23 | +11/-2 | 复用意向业务，摄影师需求目标与分页 |
| [backend/src/main/java/com/action/camera/servicepackage/repository/ServicePackageInterestRepository.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/java/com/action/camera/servicepackage/repository/ServicePackageInterestRepository.java:6) | 6 | +13/-2 | 复用意向业务，摄影师需求目标与分页 |
| [backend/src/main/resources/db/migration/add_demand_interest_targets.sql](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/resources/db/migration/add_demand_interest_targets.sql:1) | 1 | +23/-0 | 可审阅迁移及非破坏回滚说明 |
| [backend/src/main/resources/db/migration/add_privacy_rights_and_consent.sql](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/main/resources/db/migration/add_privacy_rights_and_consent.sql:1) | 1 | +49/-0 | 可审阅迁移及非破坏回滚说明 |
| [backend/src/test/java/com/action/camera/auth/AliyunSmsSenderTest.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/test/java/com/action/camera/auth/AliyunSmsSenderTest.java:74) | 74 | +15/-0 | 真实行为/数据库验证或依赖更新回归 |
| [backend/src/test/java/com/action/camera/auth/sms/dypns/DypnsSmsSenderTest.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/test/java/com/action/camera/auth/sms/dypns/DypnsSmsSenderTest.java:195) | 195 | +20/-0 | 真实行为/数据库验证或依赖更新回归 |
| [backend/src/test/java/com/action/camera/common/config/WebMvcTempStagingAuthContractTest.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/test/java/com/action/camera/common/config/WebMvcTempStagingAuthContractTest.java:42) | 42 | +2/-2 | 真实行为/数据库验证或依赖更新回归 |
| [backend/src/test/java/com/action/camera/common/config/WebMvcTempStagingCorsContractTest.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/test/java/com/action/camera/common/config/WebMvcTempStagingCorsContractTest.java:58) | 58 | +1/-1 | 真实行为/数据库验证或依赖更新回归 |
| [backend/src/test/java/com/action/camera/common/region/ProvinceNamesTest.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/test/java/com/action/camera/common/region/ProvinceNamesTest.java:1) | 1 | +26/-0 | 真实行为/数据库验证或依赖更新回归 |
| [backend/src/test/java/com/action/camera/demand/DemandInterestPersistenceTest.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/test/java/com/action/camera/demand/DemandInterestPersistenceTest.java:1) | 1 | +158/-0 | 真实行为/数据库验证或依赖更新回归 |
| [backend/src/test/java/com/action/camera/demand/DemandServiceTest.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/test/java/com/action/camera/demand/DemandServiceTest.java:94) | 94 | +12/-0 | 真实行为/数据库验证或依赖更新回归 |
| [backend/src/test/java/com/action/camera/privacy/PrivacyLifecycleIntegrationTest.java](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/backend/src/test/java/com/action/camera/privacy/PrivacyLifecycleIntegrationTest.java:1) | 1 | +192/-0 | 真实行为/数据库验证或依赖更新回归 |
| [docs/privacy/P0_PRIVACY_OPERATOR_RUNBOOK_20261030.md](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/docs/privacy/P0_PRIVACY_OPERATOR_RUNBOOK_20261030.md:1) | 1 | +45/-0 | 授权生命周期、权利申请与处理控制 |
| [harmony/entry/src/main/ets/app/AppClient.ets](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/entry/src/main/ets/app/AppClient.ets:10) | 10 | +87/-7 | 授权后初始化、账号授权同步及必要渠道 |
| [harmony/entry/src/main/ets/common/components/PortraImage.ets](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/entry/src/main/ets/common/components/PortraImage.ets:23) | 23 | +11/-3 | 撤回时移除远程图片请求旁路 |
| [harmony/entry/src/main/ets/common/location/ProvinceLocation.ets](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/entry/src/main/ets/common/location/ProvinceLocation.ets:15) | 15 | +153/-40 | 系统开关/运行时粗略授权、真实省市与引导 |
| [harmony/entry/src/main/ets/features/hall/components/HallFilters.ets](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/entry/src/main/ets/features/hall/components/HallFilters.ets:2) | 2 | +18/-3 | 系统开关/运行时粗略授权、真实省市与引导 |
| [harmony/entry/src/main/ets/features/moments/MomentDetailPanel.ets](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/entry/src/main/ets/features/moments/MomentDetailPanel.ets:1) | 1 | +18/-4 | 撤回时移除远程图片请求旁路 |
| [harmony/entry/src/main/ets/features/moments/MomentPublishPanel.ets](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/entry/src/main/ets/features/moments/MomentPublishPanel.ets:13) | 13 | +19/-3 | 撤回时移除远程图片请求旁路 |
| [harmony/entry/src/main/ets/features/publish/JournalUI.ets](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/entry/src/main/ets/features/publish/JournalUI.ets:189) | 189 | +1/-1 | 本次必要接线与访问控制 |
| [harmony/entry/src/main/ets/features/shell/PortraAppShell.ets](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/entry/src/main/ets/features/shell/PortraAppShell.ets:86) | 86 | +1/-0 | 本次必要接线与访问控制 |
| [harmony/entry/src/main/ets/features/user/DemandInterestList.ets](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/entry/src/main/ets/features/user/DemandInterestList.ets:1) | 1 | +127/-0 | 复用意向业务，摄影师需求目标与分页 |
| [harmony/entry/src/main/ets/model/ApiModels.ets](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/entry/src/main/ets/model/ApiModels.ets:674) | 674 | +9/-0 | 真实API、门禁及安全错误映射 |
| [harmony/entry/src/main/ets/network/ApiService.ets](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/entry/src/main/ets/network/ApiService.ets:2) | 2 | +24/-0 | 真实API、门禁及安全错误映射 |
| [harmony/entry/src/main/ets/network/ErrorMapper.ets](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/entry/src/main/ets/network/ErrorMapper.ets:47) | 47 | +4/-0 | 真实API、门禁及安全错误映射 |
| [harmony/entry/src/main/ets/network/HttpClient.ets](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/entry/src/main/ets/network/HttpClient.ets:8) | 8 | +18/-1 | 真实API、门禁及安全错误映射 |
| [harmony/entry/src/main/ets/pages/DemandDetailPage.ets](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/entry/src/main/ets/pages/DemandDetailPage.ets:11) | 11 | +61/-3 | 本次必要接线与访问控制 |
| [harmony/entry/src/main/ets/pages/Index.ets](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/entry/src/main/ets/pages/Index.ets:30) | 30 | +25/-3 | 授权后初始化、账号授权同步及必要渠道 |
| [harmony/entry/src/main/ets/pages/LoginPage.ets](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/entry/src/main/ets/pages/LoginPage.ets:151) | 151 | +3/-2 | 授权后初始化、账号授权同步及必要渠道 |
| [harmony/entry/src/main/ets/pages/ProfilePage.ets](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/entry/src/main/ets/pages/ProfilePage.ets:1) | 1 | +21/-305 | 并排摄影师意向及三个设置入口，移除旧本地撤回/申请注销界面 |
| [harmony/entry/src/main/ets/privacy/PrivacyApi.ets](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/entry/src/main/ets/privacy/PrivacyApi.ets:1) | 1 | +63/-0 | 授权生命周期、权利申请与处理控制 |
| [harmony/entry/src/main/ets/privacy/PrivacyConsentPage.ets](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/entry/src/main/ets/privacy/PrivacyConsentPage.ets:19) | 19 | +7/-2 | 授权生命周期、权利申请与处理控制 |
| [harmony/entry/src/main/ets/privacy/PrivacyConsentStore.ets](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/entry/src/main/ets/privacy/PrivacyConsentStore.ets:3) | 3 | +48/-2 | 授权生命周期、权利申请与处理控制 |
| [harmony/entry/src/main/ets/privacy/PrivacyRequestGuard.ets](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/entry/src/main/ets/privacy/PrivacyRequestGuard.ets:1) | 1 | +49/-0 | 授权生命周期、权利申请与处理控制 |
| [harmony/entry/src/main/ets/privacy/PrivacySettingsPage.ets](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/entry/src/main/ets/privacy/PrivacySettingsPage.ets:1) | 1 | +302/-0 | 授权生命周期、权利申请与处理控制 |
| [harmony/tests/hall-ui.test.cjs](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/tests/hall-ui.test.cjs:92) | 92 | +3/-1 | 真实行为/数据库验证或依赖更新回归 |
| [harmony/tests/moment-detail-layout.test.cjs](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/tests/moment-detail-layout.test.cjs:8) | 8 | +4/-1 | 真实行为/数据库验证或依赖更新回归 |
| [harmony/tests/privacy-account-sync.test.cjs](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/tests/privacy-account-sync.test.cjs:1) | 1 | +71/-0 | 真实行为/数据库验证或依赖更新回归 |
| [harmony/tests/privacy-consent.test.cjs](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/tests/privacy-consent.test.cjs:12) | 12 | +79/-13 | 真实行为/数据库验证或依赖更新回归 |
| [harmony/tests/privacy-image-guard.test.cjs](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/tests/privacy-image-guard.test.cjs:1) | 1 | +82/-0 | 真实行为/数据库验证或依赖更新回归 |
| [harmony/tests/privacy-network-guard.test.cjs](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/tests/privacy-network-guard.test.cjs:1) | 1 | +168/-0 | 真实行为/数据库验证或依赖更新回归 |
| [harmony/tests/privacy-settings-behavior.test.cjs](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/tests/privacy-settings-behavior.test.cjs:1) | 1 | +132/-0 | 真实行为/数据库验证或依赖更新回归 |
| [harmony/tests/province-location.test.cjs](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/tests/province-location.test.cjs:7) | 7 | +65/-6 | 真实行为/数据库验证或依赖更新回归 |
| [harmony/tests/publish-flow.test.cjs](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/tests/publish-flow.test.cjs:38) | 38 | +1/-0 | 真实行为/数据库验证或依赖更新回归 |
| [harmony/tests/ui-polish-01.test.cjs](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/tests/ui-polish-01.test.cjs:30) | 30 | +7/-4 | 真实行为/数据库验证或依赖更新回归 |
| [harmony/tests/user-system.test.cjs](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/tests/user-system.test.cjs:161) | 161 | +14/-13 | 真实行为/数据库验证或依赖更新回归 |
| [harmony/tests/v47-journal.test.cjs](C:/Users/LiXiaozhou/.codex/worktrees/harmony-c-ui-polish/Camera/harmony/tests/v47-journal.test.cjs:55) | 55 | +59/-1 | 真实行为/数据库验证或依赖更新回归 |
