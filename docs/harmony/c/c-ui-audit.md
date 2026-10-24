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
