# App challengeId 与 Backend-only 本地交付（2026-11-05）

> 历史阶段记录。当前提交、生产数据库结论、现有 staging 连接复用及原 JAR 发布方式，以 `PRODUCTION_RELEASE.md` 为准。下文准备构建/等待报告等描述保留为当时状态，不是当前执行指令。

本轮两个独立任务完成本地实现和验证；尚未进行 Main 合并、推送、GitHub Actions 运行、生产迁移、8080 部署或真机生产验收。DBA 已以 MySQL 8.0.46 / root@localhost 建立连接，生产与 Integration 结构报告由现有 DBA 流程生成。本交付不另建数据库迁移分支、不设计替代迁移。

## 候选与范围

- 发布控制独立工作树：`D:/software/Camera/output/portra-backend-only-release`，分支 `codex/portra-backend-only-production`，基线 `origin/main` 的 `2d4d5cbbbd03088648c1dc918b326d9239af4270`。只改 `.github/workflows/{ci,deploy}.yml`、`infra/production` 及本文。
- 最终后端仍为 `codex/portra-backend-final-integration` 原工作树；未重新整合、修改或重跑全套测试。既有结果 952 PASS / 0 FAIL / 2 SKIP 保留。
- 本次协议测试直接提取既有 JAR 字节码，SHA256 `c855e73e0a5a579a910e3d266d2a3c9dfbac6bf71440be37cc38e532ab1432b3`。没有重编译后端；提取工具和测试宿主在发布控制候选中，与生产 JAR 分离。
- App 修改在现有 HarmonyOS 开发工作区，限 `ApiModels.ets`、`ApiService.ets`、`LoginPage.ets`、`PrivacyApi.ets`、`PrivacySettingsPage.ets` 及对应测试；保留该工作区原有其他未提交改动。
- 不修改、测试或发布旧 Web；前一轮暂缓的 Web 改动仍只在另外的隔离工作树，不在本候选。

## App 验证

发送短信读取 `SmsChallengeResponse`，登录提交 `challengeId`。页面将挑战绑定到发送时的手机号和设备；重新发送、修改手机号、离开页面或登录成功后清除旧挑战。失败发送不能沿用旧挑战，晚到响应不能恢复已离开的页面。注销短信也接收并回传独立挑战，不能作为登录挑战使用。

本地主机测试：84 PASS / 0 FAIL。覆盖请求序列化、缺少挑战、换手机号/设备、重新发送失败、非法响应、重复点击和页面退出，以及原认证/隐私回归。

真实协议测试：13 PASS / 0 FAIL。运行候选 JAR 的真实 Spring HTTP 服务和认证/授权实现，App `ApiService`、`HttpClient`、`PrivacyApi`、`PrivacyRequestGuard` 直接发 HTTP；仅 Harmony NetworkKit 替换为 Node fetch。数据库为独立内存 H2，短信投递为本机测试替身，不连接阿里云或生产库。

1. 缺失 challengeId 被真实 Controller 拒绝。
2. App 读取真实挑战返回体。
3. 重发使旧挑战失效。
4. 挑战不能用于另一个手机号。
5. 错误验证码被拒绝。
6. 正确挑战经 App API 获取 native session。
7. 已消费挑战不能重放。
8. 无客户端声明头时，服务端仍要求账户授权。
9. App 保存授权后可访问认证业务接口。
10. 撤回后业务请求被拒绝。
11. 撤回后隐私入口仍可访问。
12. 注销挑战不能当作登录挑战。
13. App 注销请求携带挑战并得到服务端 CLOSED。

`assembleHap --no-daemon -p product=staging` 编译、打包、签名通过。产物：`D:/software/Camera/harmony/entry/build/staging/outputs/staging/entry-staging-signed.hap`，SHA256 `d83085974ebe3a5dab551e1fb5436e4a1b1843ac861d4c4331370fbb28273850`。这是当前开发工作区构建产物，包含该工作区原有改动；本轮未安装设备，不代表生产短信投递或真机主要业务验收。

复验命令（先在隔离目录启动宿主）：

```powershell
# cwd: D:/software/Camera/output/portra-backend-only-release
python infra/production/prepare-protocol.py ../portra-backend-final-candidate ../portra-protocol-test
# cwd: D:/software/Camera/output/portra-protocol-test
$cp = Get-Content classpath.txt -Raw
java -cp $cp ../portra-backend-only-release/infra/production/ProtocolHarness.java > server.log 2>&1
# 另一个终端，cwd: D:/software/Camera
$env:DEVECO_SDK_HOME='D:/software/DevEco Studio/sdk'
node harmony/tests/challenge-real-backend.cjs
```

每次真实协议复验使用新的宿主进程/内存数据库。测试手机号和短信值仅存在于本地隔离测试；不要对生产服务运行该测试。

## Backend-only 发布控制

`ci.yml` 不再调用旧的 Web/Backend 联动部署；发布 job 只依赖 backend。原 Web CI 检查保留，但不参与本次发布路径。

`deploy.yml` 的 prepare job 只构建后端、检查 JAR 内的短信/认证/隐私类、封存完整 SHA 与 SHA256，并上传不可变 artifact。deploy job 下载同一运行的 artifact，**不重新构建**。发布中没有 frontend 构建、Web SCP、`deploy-application.sh`、Nginx/systemd 配置安装或 SQL 执行。

激活要求同时满足：

- Main 分支；仓库变量 `PRODUCTION_BACKEND_ENABLED=true`；`PRODUCTION_BACKEND_APPROVED_SHA` 等于当前完整 SHA。默认缺失或 false 时不部署。
- `production` Environment；正式启用前配置 required reviewers、防自审和 Main 分支限制。本轮未修改 GitHub 环境配置。
- `PRODUCTION_HOST`、`PRODUCTION_SSH_PRIVATE_KEY`、`PRODUCTION_KNOWN_HOSTS`；固定部署用户 portra-deploy，严格校验 host key。本轮未设置这些值。
- ECS 已审批的 `/etc/portra/releases/<SHA>.json`，绑定 prepare 产物 JAR 哈希、现有 8080 JAR 哈希、主机、有效期、生产 DB 核验及备份恢复证据。目录和文件必须 root 所有且不可由部署用户写，文件需对部署账号可读。`approval.example.json` 全部默认未批准，不能直接使用。

通过 prepare artifact 获取真实 JAR 哈希后，才由获批运维固化匹配的审批凭据，再批准 Environment 激活。不要用“再次构建得到同一哈希”作为假设。

激活脚本在 ECS 本机持有互斥锁；核对现有 release 链接，安装新版本目录，原子切换后端链接并重启。检查新 JVM PID、命令行 JAR 路径、磁盘 JAR 哈希、8080 本地及 HTTPS 公开只读业务响应。默认示例使用 `/demands`，实际公开路由和数据库健康语义仍应在发布审核时确认；不虚构候选不存在的 `/health`。

Web 根路径/全部文件 SHA256 在前后比较，任何变化立即判失败；原上传文件逐项保留校验，允许新增文件，不允许原文件消失或改变。脚本没有这些目录的写操作。若正常业务并发修改历史上传文件导致核验失败，应停止并调查，不能关闭校验。

仅在全部检查通过后写入 `BACKEND_HEALTH_PASS_APP_ACCEPTANCE_PENDING`，不把进程存活当作 App 真机验收。证据位于 `/home/portra-deploy/state/backend-release-<SHA>.json`，CI 保存 artifact、JAR 哈希及激活结果。

任何失败立即使流水线失败。只有审批明确声明旧 JAR 在迁移后仍兼容，才自动恢复已核对哈希的旧 JAR；否则保留现场并要求获批运维处理，**不自动回滚到已知不兼容的旧 Main**。`FAILED_STOPPED_PIPELINE` 表示停止流水线，不保证失败服务已停止。首次发布的兼容回退 JAR/停止服务处置应复用既有回滚方案，在实库报告返回后明确，不能凭示例凭据放行。

本地验证：11 项发布控制测试通过（包括完整成功路径、健康失败停止、批准兼容回退与禁止隐式回退）；SnakeYAML 解析和重复键检查通过；检查独立后端依赖、精确 SHA 开关、Environment、无 Web 部署步骤通过；提取的 5 个 shell 步骤 `bash -n` 通过；`git diff --check` 通过。未在 GitHub 或 ECS 执行发布验证。

## 待接收与后续边界

等待现有 DBA 的生产/Integration 只读结构报告；届时仅对照既有迁移成果整理缺失增量，复用原 SQL 与回滚方案。最终候选须固化可审阅的提交与构建指纹；Main 合并及生产发布必须独立获批。通过 8080 JAR/数据/文件/Web 保留核验及 App 真机主要流程验收后，再同步最新 Main 后端到 HarmonyOS 分支并比较完整后端源码。当前不得标记 `BACKEND_ALIGNED_AND_DEPLOYED + APP_CORE_FUNCTIONS_PASS`。
