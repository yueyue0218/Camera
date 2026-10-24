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
| C-SHARED-07 / P1 | pages/Index.ets 的 Navigation 根内容保留 AppShell；底栏“我的”push Profile，返回并不销毁/重建 Feed。C 当前只有组件 aboutToAppear/aboutToDisappear，未收到 Nav 栈覆盖/显露或应用恢复信号。公共入口维护者/协调人 | Index/Navigation → PortraAppShell → MomentFeedPage 提供可观察的可见性/恢复版本与身份变化信号，沿用既有 onShown/onHidden/onNavBarStateChange 或等价机制；C 据此清理举报与旧响应并重新请求，避免全局轮询。明确根 NavBar 和 HALL destination 两种路径 | **阻塞**：当前重进刷新仅覆盖 tab 条件销毁/重建，不能宣称从个人页 pop 返回或应用恢复会自动复核。需要覆盖“动态→我的→切身份/退出→返回”及 Web 下架后导航返回；C 不直接改 Index/shell |

## A / B 举报接入交接

复用 `features/user/ReportPanel.ets`，不复制表单或 submit：

- A：targetType 为 DEMAND / SERVICE_PACKAGE，真实需求/橱窗 ID、ownerId、从真实会话读取的 currentUserId；接入既有 onRequireLogin。
- B：用户主页为 USER，真实 userId 与 owner/currentUser；由 B 对齐是否支持相应公开主页入口。
- C：MOMENT，真实 momentId、authorId、currentSession().userId 与登录回调。自己内容不显示入口。
- 在 C-SHARED-03/04 完成前，接入方需知晓既有表单生命周期与跨实例取消限制；C 的单实例挂载只降低本页冲突，不能修复共享层问题。

不申请管理员 PATCH、管理 DTO 或鸿蒙管理入口。
