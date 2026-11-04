# Portra 三线集成：2026-11-04

## 结果与边界

独立分支 `codex/portra-three-line-integration-20261104`，复用原干净 worktree
`D:/software/Camera/output/portra-final-compatibility`。基线
`f22202084a886876894bda1372c6b93b75438358`。本地提交包含 S 线合并及下述修复；
精确最终 SHA 以本报告所在提交和交付消息为准。

可以发起/更新**代码集成评审 PR**；不代表允许合并 main 或部署。没有推送、合并 main、
调用部署、访问 ECS、启动 8081、修改数据库账号/环境或发送真实短信、邮件、支付。
法律正文未改写；审核标记未修改。构建生成的是本地新产物，未覆盖服务器 JAR。

## 基线和工作线

已执行 `git fetch origin`，未执行 pull/rebase/reset/清理。
GitHub PR #32 查询结果：OPEN、MERGEABLE、base=main，head=f2220208。
查询时的远端（不保证未来不会变化）：

| 线 | ref / SHA | 相对 f2220208 |
|---|---|---|
| M | origin/main / 2d4d5cbbbd03088648c1dc918b326d9239af4270 | 已全部包含，基线领先 80 提交 |
| H | origin/feature/harmony-c-ui-polish / db878e1a85ce8862a76c3747163ad8bfda8161f2 | 已全部包含，基线领先 7 提交 |
| S | origin/codex/staging-backend-release-20261103 / f92d341a56a1dd299a975adc2070de73fc13b623 | 两项提交未包含；共同祖先 9cb64e1c07fb55af3fa0d3b7070ad97bffdb38a3 |

本次通过 merge 保留两项 S 线来源：
- `0a31b093a5927a8d662762006d2c313e1a406530`：隐私路由/发布守卫。其中大部分逻辑已在基线，新增隐私路由回归测试。
- `f92d341a56a1dd299a975adc2070de73fc13b623`：缩略图 ETag、订单统计/分页、单橱窗意向查询、社交批量查询及推荐映射优化。

全部 35 个登记 worktree 已检查：6 个历史路径不可用，其余可读取。
根 worktree 仍是 feature/harmony-c-ui-polish / 57e4c8a2，6 个 tracked 修改保持原字节，
未跟踪文件未纳入集成。另有旧集成/验收/UI worktree 的本地修改，未触碰。
详细 Git 状态保存在本地 portra-integration-20261104-evidence/worktrees.json；没有删除失效 worktree 登记。
本次集成的是经确认的远端工作线，不把其他组员尚未提交的 UI/签名配置强行导入。

## 合并决策与接口

三处文本冲突：`.github/workflows/deploy.yml`、
`infra/staging/scripts/deploy-application.sh`、`infra/staging/scripts/deploy-backend.sh`。
全部保持 f2220208 版本，保留 report migration 摘要、PNVS/challenge/隐私能力检查、
原子切换清理与不兼容回滚拒绝。不引入 S 的 backend-only 部署重写及
`health-backend-staging.sh`、`publish-backend-staging.sh`、`verify-privacy-jar.py` 三个辅助入口。
这是明确排除的部署变更，不是声称 S 的每一行都已采用。最终 .github/infra 对基线无差异。

自动合并的 ServicePackageService、SocialRelationService 已检查：保留授权、地区规范化、
撤回可见性与原有角色隔离。登录 challenge、手机号密钥流程和 runtime DDL 禁止条件保持不变。

- 新增 `/orders/summary`、`/orders/page`；旧 `/orders` 返回列表语义不变，Web/Harmony 现有调用不被强制切换。
- 新增 `/service-packages/{serviceId}/intent-state`，保留客户角色、治理可见性与离线历史访问限制。
- `/orders/page` 增加 `updatedAt DESC, id DESC` 确定性排序，回归覆盖相同时间戳跨页无重复和账户隔离。这不承诺并发更新时 offset 分页具备快照一致性。
- 新 HTTP 回归核对旧列表/新分页 DTO 和统计总数、未认证无数据、非法角色拒绝。
- JSON 业务错误沿用 HTTP 200 + code 40101/40001，而非改动全局状态码破坏客户端；文件接口保留其既有 HTTP 错误语义。
- Harmony 两个旧测试夹具分别缺少真实 Province 模块加载、使用非 UUID challenge/空发送结果；修复夹具并保留严格 challenge 校验。
- Web 已有 integratedChallengeFlow 测试补进 npm test 默认入口，避免只单独执行时才覆盖。
- 缩略图条件请求先执行当前下载授权；私有/受限图片不因 ETag 跳过授权。没有恢复真实支付。

## 实际测试

工作目录默认为本 worktree；Maven 在 backend，npm 在 frontend。
环境：Java 17.0.19、Maven 3.9.9、Node 24.15.0、DevEco API 26、本地 MySQL 8.0.41。
计数不跨行相加：定向回归/IntegrationTest 是全量集合的子集。

| 实际命令 | PASS | FAIL | SKIP | 范围 |
|---|---:|---:|---:|---|
| `mvn.cmd -B clean verify` | 952 | 0 | 2 | 954 用例；编译、JAR、JaCoCo 门禁通过 |
| 上述全量中的 `*IntegrationTest` | 96 | 0 | 0 | H2/本机随机 HTTP 端口；非 ECS |
| `npm.cmd test`（新增入口前） | 104 | 0 | 0 | auth/admin/social/image/report/routing/privacy/province |
| `npm.cmd run test:contracts` | 4 | 0 | 0 | 生产 React 处理逻辑，模拟 transport |
| `npm.cmd run lint` | 1 | 0 | 0 | 0 error，38 个现有 warning |
| `npm.cmd run build` | 1 | 0 | 0 | Vite 构建成功；大 chunk warning 保留 |
| `node --test harmony/tests/default-scheme-challenge.test.cjs harmony/tests/network.test.cjs harmony/tests/integrated-challenge-flow.test.cjs` | 43 | 0 | 0 | 定向契约/网络/页面处理逻辑 |
| `node --test harmony/tests/*.test.cjs` | 620 | 0 | 0 | Node/ArkTS harness，非设备验收 |
| `hvigorw.bat assembleHap --no-daemon -p product=staging -p buildMode=debug` | 1 | 0 | 1 | 构建成功；签名步骤因无配置跳过 |
| `python -X utf8 backend/scripts/test-integration-migration.py --mysql-bin "C:/Program Files/MySQL/MySQL Server 8.0/bin" --work-dir D:/software/Camera/output/portra-migration-20261104-run1` | 1 | 0 | 0 | 实际独立 MySQL 8.0.41，测试后进程停止 |
| `python -m unittest discover -s infra/staging/tests -v` | 12 | 0 | 0 | 合成 JAR 正反例 |
| `python infra/integration-secure-sms/test-gate.py` | 6 | 0 | 0 | 合成配置；不设置真实审核标记 |
| `bash infra/staging/scripts/validate-repository-infra.sh` | 1 | 0 | 0 | Bash/配置静态验证 |
| `bash infra/staging/scripts/verify-backend-capabilities.sh backend/target/camera-0.0.1-SNAPSHOT.jar` | 1 | 0 | 0 | JAR 结构能力底线，非运行验收 |
| `git diff --check` | 1 | 0 | 0 | 无空白错误 |

JaCoCo LINE：8485 covered / 9990 total，约 84.93%，超过 60% 门禁。
两个 SKIP 来自显式 opt-in 的 ServicePackageA2MySqlSmokeTest；没有假装其已通过。
后端覆盖短信本地校验与会话、订单/报价并发、消息、文件授权、举报治理、隐私撤回与恢复限制。
首轮失败保留在日志：Harmony 2 个过期夹具；新增 HTTP 测试初始错误期待 HTTP 401；
Windows 沙箱权限导致 Maven 缓存/离线测试临时目录失败。已修正夹具/契约预期，
权限问题在授权本地重试后通过，没有放宽生产校验。

HAP 构建进程使用 `PORTRA_ENVIRONMENT=staging`、`PORTRA_BASE_URL=https://127.0.0.1:18443`，
只作为不可部署的本地编译占位地址。未签名、未安装、未访问该地址；不得把此产物直接用于 ECS 验收。
HAP SHA256：`78d47f9604b3f93de71ca3503ba8bd029c43035cd25e6af77a9d86a4587cb596`。

## 数据库与恢复边界

迁移 SQL 无修改，无本次新增业务表迁移。历史 43 表与待批准 challenge 增量的关系已补充到
`backend/src/main/resources/db/README_EXECUTION_ORDER.md`。
本地以仓库 Path A 及已有增量构造真实 43 表，执行原 challenge SQL 后 44 表；
验证既有合成用户记录保留、5 个 nullable 列、challenge 唯一索引及锁键唯一性。
重复执行应失败，脚本不是幂等迁移器。MySQL DDL 隐式提交；真实部分失败须停止，
核对 BASE/COMPLETE/PARTIAL 后只审批缺失 DDL。不得删除列/记录以回滚，也不能回退到不支持 challenge 的 JAR。
本地保留 datadir 与诊断，私有实例禁 TCP，完全未连接已有 MySQL 服务。
SQL SHA256（本地原始字节）：`6aa039ad8923a8cef41463c5647ec4b3f832759f0a9240c0471dec7d88ed3f8f`。
这不是历史生产数据兼容性、备份恢复演练或 ECS 8.0.46 的实际证明。

## 剩余事项与 PR 操作

- 代码：本次确认的 M/H/S committed 工作线集成及本地门禁已完成，无已知失败代码测试。
  未提交的根目录 UI 工作仍由原工作线保管。新增统计/分页接口可用，但现有客户端继续兼容旧读取接口；本轮不声称已经获得客户端性能收益。
- 设备：真实双账户短信登录、切换身份/过期回包、图片网络、会话/报价/订单、授权撤回等需有签名的真机/模拟器与受控服务联调。未签名编译和 mock harness 不能替代。
- 服务器：ECS 8.0.46 迁移前审查/恢复演练、部署批准、SMTP/PNVS/密钥与环境验收仍是独立阻断；两个 Integration 账号保持锁定，8081 未启动。未复验 8080 在线状态，因本轮没有访问服务器。
- 法律：隐私政策、用户协议、个人信息出境同意书最终文案和真实审核暂缓，是后续上架阻断；现有同意、撤回及身份隔离全部保留，未伪造已审核。

推荐先推送独立评审分支 `codex/portra-three-line-integration-20261104`，不推送 main。
推送内容为本报告文件清单中的功能、测试和迁移说明，无部署入口改变。
本轮没有推送；必须先由用户确认目标分支及变更。若后续选择更新 PR #32 的旧 head，
必须先 fetch 并核对 head 仍为预期，另行明确批准，不能 force-push。

## 文件清单（相对 f2220208）

- `backend/scripts/test-integration-migration.py`
- `backend/src/main/java/com/action/camera/controller/FileController.java`
- `backend/src/main/java/com/action/camera/order/controller/OrderController.java`
- `backend/src/main/java/com/action/camera/order/dto/OrderSummaryResponse.java`
- `backend/src/main/java/com/action/camera/order/repository/OrderRepository.java`
- `backend/src/main/java/com/action/camera/order/repository/OrderStatusCount.java`
- `backend/src/main/java/com/action/camera/order/service/OrderService.java`
- `backend/src/main/java/com/action/camera/repository/UserRepository.java`
- `backend/src/main/java/com/action/camera/servicepackage/controller/ServicePackageInterestController.java`
- `backend/src/main/java/com/action/camera/servicepackage/dto/ServicePackageIntentState.java`
- `backend/src/main/java/com/action/camera/servicepackage/repository/ServicePackageInterestRepository.java`
- `backend/src/main/java/com/action/camera/servicepackage/service/ServicePackageService.java`
- `backend/src/main/java/com/action/camera/social/service/SocialRelationService.java`
- `backend/src/main/resources/db/README_EXECUTION_ORDER.md`
- `backend/src/test/java/com/action/camera/common/interceptor/AuthInterceptorTest.java`
- `backend/src/test/java/com/action/camera/controller/FileControllerTest.java`
- `backend/src/test/java/com/action/camera/integration/OrderFlowIntegrationTest.java`
- `backend/src/test/java/com/action/camera/performance/LoadingReadRepositoryTest.java`
- `backend/src/test/java/com/action/camera/servicepackage/ServicePackageRecommendationV2Test.java`
- `backend/src/test/java/com/action/camera/servicepackage/ServicePackageServiceTest.java`
- `docs/integration-20261104-three-line.md`
- `frontend/package.json`
- `harmony/tests/default-scheme-challenge.test.cjs`
- `harmony/tests/network.test.cjs`
- `harmony/tests/privacy-api-routing.test.cjs`
