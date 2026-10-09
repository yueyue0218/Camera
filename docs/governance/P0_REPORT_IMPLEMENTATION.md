# PORTRA-GOV-P0 实现与人工验收交接

> 本文件保留 P0-A～P0-D 首轮状态。2026-10-09 最终收口的新测试、真实 HTTP 结果和剩余阻塞，以 [P0_REPORT_FINAL_ACCEPTANCE.md](P0_REPORT_FINAL_ACCEPTANCE.md) 为准。

本轮仅实施 P0-A～P0-D。基准 SHA：4f844d27750dd38ce2e761c097c59f741afff76e。分支：codex/p0-report-entry-closure。
工作目录：C:/Users/LiXiaozhou/.codex/worktrees/p0-report-entry-closure/Camera。

## 实际完成

- 需求详情、橱窗详情、公开用户主页新增右上角一个更多菜单，菜单提供举报。本人内容及无有效主键/发布者 ID 的对象隐藏入口；本人用户主页仍走原来的个人主页重定向。
- 三类目标分别传 demand.demandId / service.serviceId / publicProfile.userId；所有者来自 customerId / providerId / userId。已核对后端 DTO、Controller 和 Mapper，不猜测用户角色或摄影师档案主键。
- ReportDialog 统一五种单选原因，选填说明按后端 UTF-16 长度限制最多 1000，显示余量；拒绝只有空白的说明，提交时 trim。
- 统一 reportApi 调用原有 client.request，POST /reports，不开放目标类型及主键编辑。当前 client 负责 Bearer、cookies、结果解包及网络错误。
- 提交期间立即设置同步 ref 锁并禁用表单、取消和重复提交；请求结束前不允许 Escape/遮罩关闭，避免隐藏尚未结束的请求。成功关闭并显示 PortraToast；失败保持单选及说明并展示业务错误。
- 举报 API 使用现有 suppressAuthTimeout/skipTokenExpiryCheck 选项，把过期会话的最终验证交给服务器，使举报弹窗保留失败草稿，不触发全局跳转而丢失输入。不修改认证体系，服务器照常校验会话。
- MUI Menu/Dialog 提供键盘菜单、单选导航、焦点约束；第一原因获得初始焦点，关闭后回到更多按钮。手机布局给标题区域预留菜单空间；主页标题可换行。
- P0-D 新增真实 H2 数据库集成测试：创建→管理员列表/详情→处罚→普通访问与交互受限→恢复；用户限制后旧 Access/Refresh 拒绝、解除后新会话可用；忽略、权限、自我限制、目标 ID 伪造、重复举报与真实并发竞争、失败后状态一致性。
- 故障注入测试在真实内容处罚/内容审计完成后，令最后的 REPORT 审计写入失败，验证目标、举报和审计一起回滚。注入只在测试 spy 中，不改生产服务。

## 修改文件（13 个）

| 文件 | 用途 |
|---|---|
| frontend/src/pages/hall/HallDetailPages.jsx | 需求和服务包入口，不改原响应、编辑、下架、关注、意向、聊天与图片逻辑 |
| frontend/src/pages/profile/PublicProfilePage.jsx | 用户入口，不改消息、关注、角色切换与档案展示 |
| frontend/src/pages/profile/profile.css | 仅新增举报标题行的换行/预留按钮样式 |
| frontend/src/components/reports/ReportAction.jsx | 更多菜单、本人隐藏、共享弹窗与成功 Toast |
| frontend/src/components/reports/ReportDialog.jsx | 表单、加载、错误、焦点和提交防重 |
| frontend/src/api/reportApi.js | 原有举报接口封装 |
| frontend/tests/reportEntry.test.mjs | 18 项真实组件 DOM 交互测试，网络边界用受控响应 |
| frontend/package.json | 新增 test:reports 并接入 npm test；仅增加开发测试依赖 |
| frontend/package-lock.json | 测试依赖锁定；jsdom 26 支持现有 Node 20 CI |
| backend/src/test/java/com/action/camera/integration/ReportClosureIntegrationTest.java | 15 项 H2/MockMvc 集成用例 |
| docs/governance/P0_REPORT_AUDIT.md | P0-A 契约审计 |
| docs/governance/P0_REPORT_IMPLEMENTATION.md | 本文 |
| docs/governance/P0_REPORT_TEST_REPORT.md | 命令、数量、失败与未验证边界 |

## 接口与范围

没有新增或修改服务器接口、数据库迁移、后端生产代码、订单状态机、支付、认证、信用、动态或评价逻辑；管理员页面仍使用现有列表、详情、处理与恢复接口。重复举报政策由服务器待处理唯一键决定，刷新页面不会伪装成新的可举报状态。

原始 Camera/main 的三个已修改文件与未跟踪目录未操作；仅更新了获取远端信息和创建本次 worktree 所需的 Git 元数据。没有暂存、正式提交、推送、PR 或合并。

## 人工验收状态

实现和专项验证已完成；全量后端与独立服务器前后端联调尚未通过，不能宣布最终业务验收通过。详情见测试报告。只读代码审查及后续复查未发现待修的生产代码问题，已修复角色权限掩盖下架状态验证的测试盲区、补强写入后回滚测试。未进入 P0-E/P0-F/P1/P2。

建议人工在可正常开启 Java 回环 Socket 的隔离环境运行 Maven verify，并使用测试账号执行三页面提交及管理员处理/恢复。不要对生产用户和真实业务记录执行处罚。
