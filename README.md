# Portra 约拍平台

> 软件工程课程项目 · Phase 4

约拍服务平台，连接有拍摄需求的用户与摄影师，提供橱窗展示、在线报价、订单管理、评价信用等功能，实现约拍业务闭环。

---

## 团队成员

| 姓名 | 学号 | 负责模块 |
|---|---|---|
| 曹潇月 | 241880166 | 后端骨架 · 用户认证 · 申诉仲裁 · 集成联调 |
| 王雯 | 241880256 | 需求发布 · 服务橱窗 · 作品集 |
| 牛郝彦姝 | 241880594 | 消息会话 · 订单状态机 · 照片授权 |
| 李晓宙 | 241880595 | 交付 · 评价 · 信用 · 通知 · CI/CD |

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 · Vite · React Router v6 |
| 后端 | Spring Boot 3 · MyBatis-Plus · JPA |
| 数据库 | MySQL 8.0 |
| 认证 | JWT |
| 部署 | Railway（在线）/ 本地 localhost |

---

## 本地运行

**详细步骤见 → [`docs/P4/DEMO_GUIDE.md`](docs/P4/DEMO_GUIDE.md)**

快速启动：

```bash
# 1. 启动后端（端口 8080）
cd backend
mvn spring-boot:run

# 2. 启动前端（端口 5173）
cd frontend
npm install && npm run dev
```

浏览器打开 `http://localhost:5173`，用学校邮箱注册即可（验证码由内置 QQ SMTP 发送，无需额外配置）。

---

## 项目文档

所有阶段文档位于 `docs/` 目录，按 P0–P4 阶段组织。

Phase 4 核心交付物：

| 文档 | 说明 |
|---|---|
| [`docs/P4/DEMO_GUIDE.md`](docs/P4/DEMO_GUIDE.md) | 本地运行与演示说明 |
| [`docs/P4/BUG_FIX_LOG.md`](docs/P4/BUG_FIX_LOG.md) | Bug 修复日志（四线合计 140+ 条） |
| [`docs/P4/SPRINT_BOARD.md`](docs/P4/SPRINT_BOARD.md) | Sprint 任务看板 |
