# PORTRA-GOV-P0 测试与残余风险报告

> 本文件保留 P0-A～P0-D 首轮状态。2026-10-09 最终收口的新测试、真实 HTTP 结果和剩余阻塞，以 [P0_REPORT_FINAL_ACCEPTANCE.md](P0_REPORT_FINAL_ACCEPTANCE.md) 为准。

日期：2026-10-09（Asia/Shanghai）。基准：4f844d27750dd38ce2e761c097c59f741afff76e。
所有命令在本次独立 worktree 的 frontend 或 backend 目录执行。没有删除、禁用或用 skipTests 屏蔽既有测试。

## 最终结果

| 范围 | 命令 | 结果 |
|---|---|---|
| 前端全量 | npm test | 86 通过，0 失败，0 跳过；包括原有 68 与新增 18 |
| 前端构建 | npm run build | 退出 0，成功；有 >500KB chunk 提示 |
| 后端专项 | mvn test '-Dtest=ReportClosureIntegrationTest,ReportIntegrationTest,ReportServiceTest,AdminHallModerationIntegrationTest,AdminUserRestrictionIntegrationTest' | 39 通过，0 失败，0 错误，0 跳过 |
| 后端全量及构建 | mvn verify '-Dspring.http.client.factory=simple' | 748 运行，691 通过，0 断言失败，55 错误，2 原有跳过；退出 1，构建失败 |
| Maven 编译 | mvn compile | 退出 0，编译成功；最终 verify 也完成了生产/测试代码编译 |

后端全量构建未通过，未生成或宣称通过完整 package/verify 交付。verify 在 surefire 失败，因此后续覆盖率验收也未验证。

最终专项明细：ReportClosureIntegrationTest 15、ReportIntegrationTest 2、ReportServiceTest 15、AdminHallModerationIntegrationTest 4、AdminUserRestrictionIntegrationTest 3，共 39。

### 证据日志

这些日志保留在工作目录（仓库既有 *.log 忽略规则下，不加入 Git 差异）：

- frontend/report-red.log：编码前专项 18 项，2 通过、16 失败；三页均因缺失更多入口失败。
- frontend/report-full-frontend.log：最终各组 10+42+2+9+5+18，通过合计 86。
- frontend/report-build.log：最终 Vite 构建成功。
- backend/target-baseline.log：修改前 733 项，676 通过、55 错误、2 跳过。
- backend/target-baseline-ipv4.log：仅启用测试进程 IPv4 后同样 55 错误。
- backend/target-socket-probe.log：使用 PlainSocket/IPv4 的已有 HTTP 适配器测试仍报 SocketException。
- backend/target-final-verify.log：最终全量 748 项及失败明细。
- backend/target-report-tests.log：最终独立专项 39/39 通过。
- backend/target-final-compile.log：编译成功。
- backend/target/surefire-reports/：JUnit XML 和逐类详细报告；专项重跑更新对应 XML，不改变全量日志。

首次 PowerShell 未加引号的 Maven -D 参数被拆分，Maven 在启动测试前报未知生命周期；已改为上述带单引号命令，未算入测试数量。jsdom 环境缺少 animationFrame/ShadowRoot 及 DOM 节点断言输出膨胀的问题均已在测试环境修复；最终结果是修复后的完整运行。

## 业务闭环证据与验证边界

| 场景 | 验证方式与结果 |
|---|---|
| 三页面可见条件、本人隐藏、ID 映射与原操作存在 | 实际页面组件 + AuthProvider/Router DOM 渲染，通过；HTTP 响应受控，不代表部署环境联调 |
| 单选、空白/长度、API body/Bearer、成功/失败、重复点击、刷新再举报 | 实际共享组件和真实 client，网络边界受控，通过 |
| 需求/服务包提交与管理处理、下架列表/详情/交互、原业务状态与恢复 | H2 + Spring 全服务 + MockMvc；先用合法非发布者验证正常交互成功，再验证下架后 40901，通过 |
| 用户举报、限制、旧 Access 拒绝、Refresh 服务拒绝及解除后新会话可用 | H2 + MockMvc + 真实 AuthSessionService，通过 |
| 忽略不误改业务对象、待处理重复唯一键及处理后可再举报 | H2 + 实际服务，通过 |
| 普通用户读取/处理越权、管理员不能限制自己、伪造处理 targetId | MockMvc + 实际后端权限，通过 |
| 两线程同时创建、同时处理 | 真实服务/事务/H2，唯一待处理记录、一个成功一个冲突、单次审计，通过 |
| 目标已隐藏导致处罚失败 | 真实后端状态冲突后举报仍 PENDING、无额外审计，通过 |
| 真实处罚与内容审计写入后，最终举报审计失败 | 仅故障点使用 MockitoSpyBean，目标可见性、举报状态与全部审计回滚，通过 |
| 320px/375px 共享弹窗、键盘菜单、初始原因焦点、Escape/焦点恢复 | 实际浏览器临时 UI 预览，通过；320px 对话框 x=32..288/width=256，375px x=32..343/width=311，页面宽度等于视口，无横向溢出 |
| 三完整页面在所有屏幕的视觉布局与全部既有业务按钮操作 | 未全部实测；只做上述 DOM 回归与共享弹窗预览，页面改动很小 |
| 独立 HTTP 服务上的前后端真实联调 | 未验证；本机 Java 回环 Socket 错误阻止相关服务器测试 |
| 生产 MySQL 的锁、唯一键和事务、真实用户业务处罚 | 未验证；只使用隔离 H2，从未处罚生产用户 |

浏览器预览采用明确标注的测试内容，未提交真实举报；预览文件、服务与临时标签页已清理，视口已恢复。它只证明显示与键盘行为，不是业务验收数据。

## 全量后端阻塞：修改前已存在的 55 个错误

复现：在 backend 运行 mvn test '-Dspring.http.client.factory=simple'（修改前）或最终 mvn verify '-Dspring.http.client.factory=simple'。

根部异常：java.net.SocketException: Invalid argument: connect。部分 Spring RANDOM_PORT 上下文因 Tomcat Unable to establish loopback connection 启动失败，后续用例报 ApplicationContext failure threshold；已有 HTTP 适配器也在本地连接报错。IPv4 与 PlainSocket 参数诊断没有解决。没有证据把它归因为本次举报代码，也没有通过改测试配置/跳过测试掩盖问题。

| 既有测试类（backend/src/test/java/com/action/camera/ 下） | 错误数 |
|---|---:|
| delivery/adapter/COrderHttpAdapterTest.java | 3 |
| integration/AuthAndSessionIntegrationTest.java | 12 |
| integration/B1B2RouteAuthIntegrationTest.java | 5 |
| integration/DemandIntegrationTest.java | 17 |
| integration/OrderFlowIntegrationTest.java | 13 |
| servicepackage/ServicePackageShowcaseContractTest.java | 5 |

影响：全量服务启动/HTTP 测试与完整 Maven 构建无法验收；不妨碍已运行的举报 MockMvc/H2 专项，但二者不能等同。后续方案：在允许 Java 回环连接的本地/CI 隔离环境重跑原命令，核查 JDK/Windows Socket 运行环境；无需为此改举报业务或重构认证。准确失败用例名称见下附录及全量日志。

## 残余风险与后续（本轮停止）

1. 独立服务器联调、全量构建、MySQL 并发行为未验证，不得标记最终验收通过。
2. 现有 ReportService/ContentModerationService/AdminUserService 记录处罚与举报审计，但未发送治理业务通知。属于现有能力缺口，本轮没有扩展通知模块。
3. 后端允许已处理后的再次举报；本轮保持原策略，待处理重复由数据库唯一键限制。没有前端持久化禁用来伪装去重。
4. 构建有大 chunk 提示；pom.xml 有既有重复 JaCoCo 插件声明；npm ci 在基线及最终依赖调整均报告 11 项依赖漏洞（2 low/2 moderate/7 high）。未执行无关重构或 npm audit fix。
5. 未发现本次证据支持的新增 P0 权限缺陷；这是有限审查结论，不代表完成未授权的 P0-F 全面审计。

交付保持未提交差异，等待人工审查。P0-E、P0-F、P1、P2 未实施。

## 全量错误用例附录

### com.action.camera.delivery.adapter.COrderHttpAdapterTest

- resultForbiddenCodeMapsToForbiddenBusinessException
- httpNotFoundMapsToNotFoundBusinessException
- getOrderSnapshotReadsOrderFieldsFromResultData

### com.action.camera.integration.AuthAndSessionIntegrationTest

- phoneAuthCors_allowsCredentialedLocalWebRequests
- protectedEndpoint_withForgedXUserId_returns401
- protectedEndpoint_withoutAuth_returns401
- protectedEndpoint_withDisabledSignedBearer_returns401
- testAndDebugEndpoints_areNotMapped
- switchRole_customerToProvider_succeeds
- protectedEndpoint_withUnknownXUserId_returns401
- protectedEndpoint_withSignedBearerToken_succeeds
- removedSessionEndpoint_doesNotIssueProviderDemoToken
- getUserBrief_validId_succeeds
- removedSessionEndpoint_doesNotIssueCustomerDemoToken
- protectedEndpoint_withForgedAdminHeaders_returns401

### com.action.camera.integration.B1B2RouteAuthIntegrationTest

- ownerHistoryRoutesRequireExpectedRoles
- startChatRejectsUnknownDemoUserBeforeConversationCreation
- oldDemandRouteAllowsPublicGetButRequiresAuthenticatedCustomerForWrites
- oldServiceRouteAllowsPublicGetButRequiresAuthenticatedProviderForProviderWrites
- publicHallGetRejectsRemovedDemoTokenEvenWithForgedHeaders

### com.action.camera.integration.DemandIntegrationTest

- createDemand_asProvider_returnsForbidden
- listDemands_withTimeTag_returnsOnlyTaggedDemands
- getDemand_ownDemand_succeeds
- deleteDemand_byOwner_hidesWithoutPhysicalDelete
- createDemand_noAuthHeader_returnsUnauthorized
- getDemand_openDemand_noAuthSucceeds
- getDemand_closedDemand_noAuthDoesNotUseDefaultCustomerAsOwner
- respondToDemand_asProvider_succeeds
- createDemand_withCustomerHeader_succeeds
- respondToDemand_duplicateResponse_returnsConflict
- acceptResponse_writesProviderNotificationsForResponseAndConversation
- myDemandHistory_returnsOwnOpenAndClosedDemandsExceptHidden
- deleteDemand_byStranger_returnsForbidden
- getDemand_nonExistent_returns404
- listDemands_noAuth_succeeds
- rejectResponse_writesProviderNotificationForRejectedResponse
- listDemands_withFilters_returnsFiltered

### com.action.camera.integration.OrderFlowIntegrationTest

- mockPay_sameAmountTwice_isIdempotentAndCreatesOnePaymentRecord
- concurrentMockPay_createsOnePaymentRecord
- statusLogs_afterCustomerCompletes_containsLog
- paymentRecord_orderIdHasDatabaseUniqueConstraint
- mockPay_differentAmountAfterPayment_returnsErrorAndCreatesOnePaymentRecord
- statusTransition_paidToShooting_returnsError
- statusTransition_illegalJump_returnsError
- mockPay_wrongUser_returnsForbidden
- listOrders_asCustomer_returnsOnlyMine
- getOrder_byStranger_returnsForbidden
- getOrder_byParticipant_succeeds
- mockPay_pendingOrder_statusBecomesPaidPendingShoot
- mockPay_wrongAmount_returnsError

### com.action.camera.servicepackage.ServicePackageShowcaseContractTest

- photographerCanEditAndOfflineOwnPackageWithoutOrderOrPayment
- customerInterestIsIdempotentCancelableAndListSupportsTimeTagFilter
- publishListAndDetailExposeShowcaseTimeAndPhotographerContractFields
- providerHistoryReturnsOwnOnlineAndOfflinePackagesExceptHidden
- startChatUsesConversationModuleWithoutChangingPackageStatusOrAvailability

## 既有跳过用例

- com.action.camera.servicepackage.ServicePackageA2MySqlSmokeTest.recommendationUsesFixedSevenSqlStatementsForAllFrozenCandidates（原有标记，本次未新增）
- com.action.camera.servicepackage.ServicePackageA2MySqlSmokeTest.sameA1RequestUsesFixedEightSqlStatementsAgainstFrozenMySqlDataset（原有标记，本次未新增）
