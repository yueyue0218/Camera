# Portra 约拍平台

> 南京大学软件工程课程项目 · Phase 4 · 2026 春

Portra 是一个连接摄影师与有拍摄需求用户的垂直服务平台。用户可以在平台上浏览摄影师橱窗、发布约拍需求、在线沟通报价、支付担保、管理交付与评价，完成从"找摄影师"到"拿到片子"的完整业务闭环。

---

## 核心功能

| 模块 | 功能描述 |
|---|---|
| 用户认证 | 邮箱注册（QQ SMTP 验证码）、JWT 登录、双角色身份（消费者 / 摄影师） |
| 橱窗大厅 | 摄影师发布服务套餐（含封面、价格、风格标签），消费者浏览、收藏、发起约拍 |
| 需求大厅 | 消费者发布拍摄需求，摄影师主动响应，消费者接受响应后建立会话 |
| 在线报价 | 摄影师在会话中发起正式报价，消费者确认后生成订单 |
| 订单状态机 | 完整的 14 状态流转（待支付 → 拍摄中 → 待交付 → 已完成 / 退款 / 申诉等） |
| 支付担保 | 平台托管资金，交付确认后释放，异常可发起申诉仲裁 |
| 作品交付 | 摄影师上传交付包，消费者可申请返修，支持多轮交付；系统自动推进状态 |
| 照片授权 | 消费者可授权摄影师将客片展示为公开作品集 |
| 评价与信用 | 双向评价（文字 + 评分），信用分影响摄影师排序 |
| 申诉仲裁 | 消费者 / 摄影师均可发起申诉，管理员居中仲裁 |
| 动态广场 | 用户发布拍摄记录（图文），支持点赞、关注、评论 |
| 个人主页 | 消费者 / 摄影师双档案独立管理，含订单、评价、关注、收藏、信用分详情 |
| 站内通知 | 状态变更、报价、评价等关键事件实时推送通知 |
| 消息会话 | 摄影师与消费者的一对一会话，报价在会话中内嵌展示 |

---

## 技术栈

| 层 | 技术选型 |
|---|---|
| 前端 | React 18 · Vite · React Router v6 · Axios |
| 后端 | Spring Boot 3 · MyBatis-Plus · Spring Data JPA |
| 数据库 | MySQL 8.0 |
| 认证 | JWT（无状态，双角色 claim） |
| 邮件 | QQ SMTP（smtp.qq.com:587） |
| 测试 | JUnit 5 · Spring Boot Test · H2 内存库（398 项测试，全部通过） |
| 覆盖率 | JaCoCo，行覆盖率 **80.21%**（要求 ≥ 60%） |
| CI | GitHub Actions（lint → build → test → jacoco report） |
| 部署 | Railway（在线）/ 本地 localhost |

---

## 团队成员

| 姓名 | 学号 | 负责模块 |
|---|---|---|
| 曹潇月 | 241880166 | 后端骨架 · 用户认证 · 数据库设计 · 申诉仲裁 · 集成联调 |
| 王雯 | 241880256 | 需求发布 · 服务橱窗 · 作品集 · 前端 UI |
| 牛郝彦姝 | 241880594 | 消息会话 · 照片授权 · 数据库设计· 订单状态机 |
| 李晓宙 | 241880595 | 交付 · 评价 · 信用 · 通知 · 动态 · CI/CD |

---

## 快速启动

**环境要求**：Java 17、Maven 3.8+、Node 18+、MySQL 8.0

```bash
# 1. 初始化数据库
# 在 MySQL 中执行：
CREATE DATABASE camera_app CHARACTER SET utf8mb4;
# 然后导入：backend/src/main/resources/db/migration/V1__baseline.sql

# 2. 启动后端（端口 8080）
cd backend
mvn spring-boot:run

# 3. 启动前端（端口 5173）
cd frontend
npm install && npm run dev
```

浏览器打开 `http://localhost:5173`，用任意邮箱注册即可（系统内置 QQ SMTP，验证码自动发送，无需额外配置）。

完整演示流程（账号注册、双角色切换、完整订单链路）见 → [`docs/P4/DEMO_GUIDE.md`](docs/P4/DEMO_GUIDE.md)

---

## 项目质量指标

| 指标 | 数值 |
|---|---|
| 后端测试用例 | 398 项，全部通过，0 Failures / 0 Errors |
| JaCoCo 行覆盖率 | **80.21%**（4081 / 5088 行） |
| 订单状态机覆盖率 | **100%** |
| CI 流水线 | GitHub Actions 全绿（lint + build + test + jacoco） |
| Bug 修复记录 | 四线合计 140+ 条，详见 BUG_FIX_LOG.md |
| AI 协作实验 | 代码信任度实验 + 调试对决实验，均有完整报告 |

---

## Phase 4 交付物

| 文档 | 说明 |
|---|---|
| [`docs/P4/DEMO_GUIDE.md`](docs/P4/DEMO_GUIDE.md) | 本地运行与完整演示说明（24 节，含所有功能路径） |
| [`docs/P4/BUG_FIX_LOG.md`](docs/P4/BUG_FIX_LOG.md) | 四名成员 Bug 修复日志 |
| [`docs/P4/SPRINT_BOARD.md`](docs/P4/SPRINT_BOARD.md) | Sprint 任务看板（全部完成） |
| [`docs/P4/CI_RUN_RECORD.md`](docs/P4/CI_RUN_RECORD.md) | CI 流水线运行记录 |
| [`docs/P4/coverage/README.md`](docs/P4/coverage/README.md) | JaCoCo 覆盖率报告摘要 |
| [`docs/P4/"AI代码信任度实验"报告.md`](docs/P4/) | AI 辅助开发实验报告 |
| [`docs/P4/"AI调试对决"实验报告.md`](docs/P4/) | AI 调试能力对比实验报告 |
