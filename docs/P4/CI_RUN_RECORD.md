# Phase 4 CI Run Record

- 正式配置文件：`.github/workflows/ci.yml`
- 本地验证日期：2026-06-07
- 当前分支：`main`
- 当前 commit ID：`0001af8ed354f9a46fd026579bb642cd663b9b34`
- 前端 `npm ci` 结果：成功
- 前端 `npm run lint` 结果：成功，`0` 个 error，`45` 个 warning
- 前端 `npm run build` 结果：成功，生成 `frontend/dist/`
- 后端集成测试结果：成功，`Tests run: 41, Failures: 0, Errors: 0, Skipped: 0`
- 后端 `clean verify` 结果：成功，`Tests run: 398, Failures: 0, Errors: 0, Skipped: 0`
- JaCoCo 行覆盖率：`80.21%`
- 是否达到 60%：是
- 生成的 artifacts：
  - `backend/target/site/jacoco/index.html`
  - `backend/target/site/jacoco/jacoco.xml`
  - `backend/target/site/jacoco/jacoco.csv`
  - `backend/target/*.jar`
- GitHub Actions 最近一次运行链接：待推送后回填
- 截图位置：待推送后回填

---

## CD 部署配置记录（2026-06-14）

### 平台迁移说明

Phase 4 截止日期前，项目曾尝试使用 **Vercel（前端）+ Railway（后端）** 进行在线部署，但受以下问题阻塞：

1. Railway 后端服务触发邮箱验证流程，账号被拦截，无法完成服务创建。
2. Vercel 前端 API 请求频繁出现 **404**，根因为跨平台跨域配置复杂，调试成本高。
3. 两平台免费层冷启动慢、稳定性差，不符合演示需求。

经评估后决定**迁移至阿里云 ECS**（`47.250.86.6`），从零搭建 Java 17 + MySQL + Nginx + systemd 完整环境，彻底解决上述问题。

### 服务器环境

| 项目 | 配置 |
|---|---|
| 服务器 | 阿里云 ECS |
| IP | `47.250.86.6` |
| 运行时 | Java 17 + MySQL 8.0 + Nginx |
| 进程管理 | systemd（服务名 `camera-backend`） |
| 前端托管 | Nginx 反向代理，静态文件目录 `/var/www/dist` |
| 后端部署路径 | `/opt/camera-app/app.jar` |

### GitHub Actions CD 工作流（`deploy.yml`）

触发条件：`Project CI` 工作流在 `main` 分支运行成功后自动触发。

部署步骤：
1. 从 CI artifact 下载前端 `dist/` 和后端 `*.jar`
2. 通过 `appleboy/scp-action` 将文件 SCP 推送至服务器
3. 通过 `appleboy/ssh-action` 执行 `systemctl restart camera-backend` + `nginx -s reload`
4. 等待 5 秒后验证服务状态 `systemctl is-active camera-backend`

所需 GitHub Secrets（已配置 ✅）：`DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_KEY`

### 当前状态

- 数据库建表完成，`http://47.250.86.6` 可访问 ✅
- CI/CD 工作流配置完毕，push main 后将自动触发端到端部署 ✅
