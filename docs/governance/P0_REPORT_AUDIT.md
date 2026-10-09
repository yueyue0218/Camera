# PORTRA-GOV-P0 初始审计

> 本文件保留 P0-A～P0-D 首轮状态。2026-10-09 最终收口的新测试、真实 HTTP 结果和剩余阻塞，以 [P0_REPORT_FINAL_ACCEPTANCE.md](P0_REPORT_FINAL_ACCEPTANCE.md) 为准。

基准：4f844d27750dd38ce2e761c097c59f741afff76e（2026-10-09 获取 origin/main）。独立分支 codex/p0-report-entry-closure。原 main 的修改与未跟踪目录均保留。

## P0-A 契约与真正缺口

三个页面均无现成更多菜单或举报入口；需求与橱窗已有编辑、下架等操作，保持原样。新增共享 ReportAction + ReportDialog，复用已有 MUI Menu/Dialog、PortraToast 和 surface tokens，不增加业务接口。

| 对象 | 真实 ID | 所属用户 | 证据 |
|---|---|---|---|
| DEMAND | demand.demandId | demand.customerId | DemandDto、DemandController |
| SERVICE_PACKAGE | service.serviceId | service.providerId | ServicePackageDetailDto、ServicePackageController |
| USER | publicProfile.userId | 同用户 ID | PublicProfileResponse、用户 public-profile 接口 |

统一 client.request 使用 Bearer 与 credentials: include，无 X-User 身份头；成功解包 {code:200,data:...}；业务错误抛出包含 code/status 的 Error。POST /reports 字段为 targetType、targetId、reason、description；成功为 ReportResponse（reportId、PENDING 状态等）。

ReportService：reason trim 后必填且最多 500 UTF-16 单元；description 可空，trim 后最多 1000 单元。枚举 USER/DEMAND/SERVICE_PACKAGE/MOMENT/REVIEW。ReportTargetValidator 拒绝本人/本人内容、不存在对象；需求与服务调用实际详情服务验证可见性。USER 检查存在性，没有额外 ACTIVE 限制。

重复政策：同一举报者+类型+对象 ID 的待处理记录由 active_dedupe_key 唯一约束防重；返回 40902。处理后释放该键，可以再举报；本轮不改变政策。

## P0-D 既有闭环与安全机制（代码审查不等同运行通过）

ReportService.resolve 只接受 resolution、adminComment，目标来自服务器保存的举报，不接受客户端覆盖 targetId。每个 admin 服务检查权限；悲观锁防并发处理，已处理返回 40901。IGNORE 不改变对象；内容处罚委托 ContentModerationService，独立 moderation 状态隐藏/恢复，不改变订单/业务状态；用户限制委托 AdminUserService，可经既有用户状态接口恢复。处理与处罚均记录 adminId、时间、原因，事务覆盖对象、举报和审计。

AuthInterceptor 每次请求查用户 ACTIVE、有效会话及角色绑定；AuthSessionService.refresh 拒绝 DISABLED。AdminUserService 拒绝管理员禁用自己及最后一位有效管理员。公开列表排除隐藏，详情仅允许发布者/管理员访问。举报/处罚代码没有调用通知服务，业务通知不是现有能力，列为残余缺口，不扩展通知模块。

现有 ReportServiceTest 对目标校验采用 mock，不能独自证明真实权限及数据库一致性；现有 ReportIntegrationTest 只含 USER/IGNORE 与列表越权，需要三类完整数据库闭环、校验、重复与竞争处理测试。

## 修改边界

仅两处目标页面、共享举报 UI/API、前端测试依赖与命令、举报集成测试及文档。后端生产代码保持只读，复现真实缺陷才提出最小修复。P0-E/P0-F/P1/P2 未授权。

前端基线 npm test：68 项通过。后端基线与最终结果见 P0_REPORT_TEST_REPORT.md。
