# C 模块阶段性交付

日期：2026-10-25（北京时间）。这是可独立评审的 Feed/举报入口阶段，不代表完整 C 模块验收通过。

基线：`b258ec8114ac1ff8f360099155f5d284f1247c41`；工作分支：`feature/harmony-c-ui-polish`；唯一 PR base：`integration/harmony-v1`。保留原有 C UI、AppClient/ApiService 接线，未修改 main、公共底座、B 举报表单、A/B/D 页面、Web 或后端。

## 修改文件与真实行为

| 文件 | 用途 |
| --- | --- |
| harmony/entry/src/main/ets/pages/MomentFeedPage.ets | latest/hot/following 真实 scope；可观察刷新忙碌态；保留有效列表的失败提示；旧列表/收藏/举报身份响应按视图和会话隔离；收藏按服务器结果更新、不明结果先刷新；缓存首屏后重新请求；真实身份及单一举报对象入口 |
| harmony/entry/src/main/ets/features/moments/MomentFeedModels.ets | TTL 缓存按 scope/session 隔离；时钟倒退不命中；维持 ID 去重；按会话持有跨实例在途收藏，新实例等待写请求结束后读取 |
| harmony/entry/src/main/ets/features/moments/MomentCard.ets | 预览不冒充完整图数；分开互动栏和角色/举报栏减轻小屏挤压；全局串行收藏时禁用相关操作；辅助名称；可选举报回调与默认属性保持 B 的只读调用兼容 |
| harmony/tests/moment-feed.test.cjs | 新增 scope/session 缓存行为；仅调整已过时的固定 latest 源码断言，保留既有检查 |
| harmony/tests/moment-feed-behavior.test.cjs | 执行真实页面方法，覆盖快切频道、刷新失败/真实空态、旧会话/离页、收藏并发/结果不明、缓存重建/重新校验、真实举报对象/身份与失败重试 |
| docs/harmony/c/c-ui-audit.md | 基线、范围和实施清单 |
| docs/harmony/c/shared-change-requests.md | C-SHARED-01–07 与 A/B 举报接入交接 |
| docs/harmony/c/c-module-delivery.md | 本交付与验证分层 |

接入的现有接口：`GET /moments?scope=latest|hot|following`、`PUT/DELETE /moments/{id}/favorite`、`GET /auth/session`；举报复用既有 ReportPanel → `POST /reports`，传 MOMENT、真实 momentId/authorId/currentUserId，未复制表单和请求逻辑。只有服务器成功空数组才显示空态；关注频道有独立空态。列表不虚构分页。

收藏以返回的匹配 momentId、合法状态及计数为准；失败不本地伪造成功。请求结果不明时使 C 缓存失效、禁用继续收藏并提示先刷新；重新读取成功才恢复。操作期间收藏/刷新互斥、频道暂时禁用，防止旧快照覆盖。离页不丢弃 C 共享在途记录；同会话新实例等待其结束后才发列表请求，旧会话完成只失效对应会话缓存。401 沿用认证底座，403 不清会话。超时仍不代表服务端未写入，不承诺 exactly-once。

举报身份未读取成功前不展示可操作入口；身份读取失败可见且可重试。自己的动态隐藏举报；页面同时最多挂载一个既有表单，切换目标/频道、刷新或离页时清理选中项。**这不修复 B 表单内部的提交生命周期和共享取消问题**，详见 C-SHARED-03/04；真实提交仍未验收。

未发现鸿蒙 C 发布/编辑/删除或管理员入口，本轮未新增这些系统。未合并现有 Web moments 分支。

## 验证命令与结果

下列命令使用本机 DevEco Studio 随带 Node/SDK/Hvigor；仓库不记录个人绝对路径。

| 层级 | 实际命令 / 退出码 | 结果与界限 |
| --- | --- | --- |
| 起点 | `git fetch origin`，0；`git rev-parse origin/integration/harmony-v1`，0 | 与指南起点一致 |
| 基线 C/B 测试 | `node --test tests/moment-feed.test.cjs tests/user-system.test.cjs`，0 | 7/7，通过后开始新增行为 |
| RED 证据 | 新 C 行为 + 缓存测试，1 | 首轮 13 项中 8 失败：缺 scope 方法、串缓存、旧收藏写入、刷新互斥、结果不明、缓存重进、旧会话；新增举报 3 项因缺真实身份读取失败；缓存重建用例在修复前也独立失败 |
| 定向回归 | `node --test tests/moment-feed.test.cjs tests/moment-feed-behavior.test.cjs tests/user-system.test.cjs`，0 | 接举报后 19/19；后续缓存重建修复纳入全套 |
| 全套逻辑 | `$testFiles = Get-ChildItem ./tests/*.test.cjs ...; node --test $testFiles`，0 | 当前 83/83，0 失败，含现有认证、网络、导航、用户及约拍测试；测试替身不代表真实联调 |
| 依赖恢复 | `ohpm install --all`，0 | 使用现有锁定版本；锁文件未修改。首次尝试不支持的 `--frozen-lockfile` 退出 1，查看本机帮助后改用现有安装命令，没有升级依赖 |
| HAP | `hvigorw.bat assembleHap --no-daemon -p product=dev`，0 | SDK/目标 26.0.0；初次 34 tasks，最终修复后增量 33 tasks（17 执行、16 up-to-date），两次均完成 ArkTS 编译和 HAP 打包；未配置签名，因此为未签名 HAP |
| 设备发现 | `hdc list targets`，0 | 无目标输出；未安装、运行或视觉验收 |
| 差异 | `git diff --check`，0 | 仅 C 范围文件，产物与个人配置不提交 |

HAP 未设置 PORTRA_BASE_URL，因为当前没有获确认的测试 origin；按原工程契约保持网络禁用。该包仅验证编译，不是已连通的联调包。没有沿用历史临时 IP，也没有改签名、SDK、TLS 或构建配置。构建工具首次初始化有 pnpm 安装输出与上游 audit 提示，本轮未执行自动升级/force 修复。

Node 行为测试仅省略 ArkUI build/decorator 后运行同一页面的实际业务方法，AppClient 为延迟网络替身；不会证明 ArkUI 响应式更新、真实导航生命周期、键盘、安全区或后端写入。完整 ArkTS 语法另由上述 HAP 编译验证。

## 验收与剩余项

| 项目 | 状态 | 证据 / 原因与负责人 |
| --- | --- | --- |
| Feed/筛选/缓存/刷新 | 逻辑通过；设备未验证 | 行为回归通过，真实请求契约沿用；360/390/430 vp、大字体与坏图视觉待设备 |
| 导航覆盖后返回/应用恢复 | 阻塞 | C-SHARED-07：Index/shell 未传递覆盖/显露信号；当前组件生命周期仅覆盖 tab 销毁/重建。个人页切身份/退出后 pop 返回可能保留旧列表/举报身份，主动操作才进行会话核对；需公共维护者接入真实生命周期，不能将 Node 手动生命周期用例当作此路径已通过 |
| 收藏 | 逻辑通过；真实后端未验证 | 服务端结果替身回归，未取得真实普通账号 |
| B 卡片/收藏兼容 | 构建与逻辑通过；联动未验证 | ProfilePage 的 MomentCard({ item }) 不变；其收藏入口重新请求 listFavoriteMoments；需 B 设备联验 |
| 点赞 | 阻塞 | C-SHARED-01，公共维护者尚未提供方法；计数只读，未接假操作 |
| 详情/完整多图/作者跳转 | 阻塞 | C-SHARED-02/05；未用列表三张伪装完整相册 |
| 举报入口 | 逻辑/编译通过；真实提交未验证 | 真实 ID 接线；未生成真实 reportId；B 表单生命周期及公共 key 隔离待整合 |
| Preview/设备 | 未验证 | 无已连接设备；布局只做源码核查，无截图证据 |
| Web 部署/后端版本 | 未验证 | 没有确认当前部署 URL、版本或同源测试数据；仓库代码存在不算部署证据 |
| HAP 安装/签名 | 阻塞 | 构建未签名，无设备；未改团队签名配置 |

## Web 治理跨端 X01–X07

只读已核对 MomentController/MomentService、ReportController/AdminReportController/ReportService、adminApi/AdminReportsPage/AdminFeedPage。仓库契约：PENDING/RESOLVED；resolve 为 PATCH `/admin/reports/{id}/resolve`；MOMENT 支持 IGNORE/TAKE_DOWN/RESTORE 组合校验；已处理记录不可重复 resolve；动态恢复走已有 `/admin/moments/{id}/restore`。未把这些接口接入鸿蒙。

| 编号 | 状态 | 未验证原因 |
| --- | --- | --- |
| X01 鸿蒙提交 | 未验证/阻塞 | 无设备、已签名联调包、获准同源环境与普通举报人/作者账号；reportId/momentId 未产生 |
| X02 Web 查同一举报 | 未验证/阻塞 | X01 未产生对象，未提供合法管理员访问及可用部署 |
| X03 Web 下架 | 未验证/阻塞 | 无获准测试对象/管理员环境，未对任何真实内容执行管理写入 |
| X04 鸿蒙刷新/详情 | 逻辑局部通过；跨端阻塞 | Feed 主动刷新及重进确实重新请求；详情公共能力缺失，无真实下架对象 |
| X05 Web 恢复 | 未验证/阻塞 | 无前置测试对象；只读核对合法恢复接口，不重复 resolve |
| X06 IGNORE | 未验证/阻塞 | 无第二条测试举报与管理员环境；不推断可见性已实测 |
| X07 普通用户管理权限 | 未验证/阻塞 | 无获准普通测试账号/环境；未添加鸿蒙管理入口 |

协调人后续需提供公共依赖提交/关联 PR、B 表单归属结论，以及获准环境、双普通账号和管理员访问方式。完整 C 验收需要补齐这些依赖与设备/后端/Web 证据；本阶段 PR 不自动合并。

## 独立审查记录

审查发现跨实例收藏交错：旧页发起收藏后销毁，新实例先 GET 旧状态，旧写入随后完成。已新增可复现的行为用例，先观察失败（提前发出第二个列表请求），再增加 C 共享 pending 保护，完整回归 83/83。另发现 Navigation 覆盖/显露信号缺失，因文件归属限制登记 C-SHARED-07，保持阻塞并仅交草稿 PR，不把现阶段作为可验收首发功能。独立审查最终结论：无 Critical、无单独遗留 Minor；跨实例收藏修复已复核；导航缺口为未解决 Important，允许草稿评审，不建议按完整模块合入。
