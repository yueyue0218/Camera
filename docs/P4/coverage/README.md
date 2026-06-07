# 单元测试覆盖率报告摘要

> 分支：`main` | 生成时间：2026-06-07 | 命令：`mvn test jacoco:report`  
> 报告位置：`backend/target/site/jacoco/index.html`（本地运行后可查看 HTML 详情）

---

## 整体覆盖率

| 指标 | 数值 | 验收要求 |
|---|---|---|
| **行覆盖率** | **80.2%** (4081 / 5088 行) | >= 60% ✅ |
| **指令覆盖率** | **76.6%** (17167 / 22407 条) | 参考值 |

---

## 核心模块覆盖率

| 模块 | 行覆盖率 | 说明 |
|---|---|---|
| order.statemachine | 100.0% | 订单状态机，全覆盖 |
| order.scheduler | 100.0% | 自动确认 / 超时退款定时任务 |
| notification.service | 96.7% | 站内通知核心逻辑 |
| order.controller | 95.3% | 订单接口层 |
| servicepackage.controller | 94.1% | 橱窗接口层 |
| certification.dto | 93.8% | 认证 DTO |
| order.service | 90.6% | 订单业务核心 |
| demand.service | 88.8% | 需求发布与响应 |
| servicepackage.service | 80.8% | 橱窗管理 |
| review.service | 81.6% | 评价与信用 |
| delivery.service | 64.2% | 交付模块 |
| credit.controller | 70.9% | 信用分接口 |
| certification.service.impl | 74.7% | 认证审核服务 |

---

## 生成方式

```bash
cd backend
mvn test jacoco:report
# 报告输出至 target/site/jacoco/index.html
```

---

## 测试运行结果

所有测试通过，退出码 0。测试使用 H2 内存数据库，与生产 MySQL 结构保持同步（`schema-h2.sql`）。
