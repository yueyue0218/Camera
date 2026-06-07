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
