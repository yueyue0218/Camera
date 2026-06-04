# D 线后端只读审查与修复规划

本轮先按用户确认解决冲突，再把范围扩展为 D 线后端 + Moments/social 后端修复。已处理的冲突仅限 `backend/src/main/java/com/action/camera/common/config/WebMvcConfig.java`：三方冲突点是全局鉴权排除列表中 `/moments/**` 与 `/demands/**` 的取舍，最终保留当前工作树结果，不再整体排除这两个路径，避免 Moments/Demand 创建、响应等依赖 `UserContext` 的接口被匿名放行。

修复状态：已完成 D 线后端与 Moments/social 后端本轮修复，并补齐测试与迁移草案。

测试结果：

```text
mvn -q "-Dtest=ReviewServiceTest,ReviewComplaintServiceTest,NotificationServiceTest,CreditControllerTest,MomentServiceTest,SocialRelationServiceTest" test
mvn -q test
```

重要边界：当前分支仍是 `feature/d/frontend`，工作区仍混有前端、文档、临时 HTML 和未跟踪文件。本次提交只应选择 D 线 + Moments/social 后端相关文件，不应把前端和原型文件带入。

## 11.1 当前分支状态

```text
当前分支：feature/d/frontend
是否为安全的 D 线后端分支：否，分支名和工作区内容都混入前端/Moments/social 工作。
是否存在未提交修改：是。
是否混入前端文件：是。
是否适合开始修复：已按用户确认在当前分支修复，但提交必须选择性 stage 后端相关文件。
```

最近提交：

```text
ad94bf0 (HEAD -> feature/d/frontend, origin/frontend) 完成开屏页搜索小图标的跳转
fd214ae 链接
3b589d1 fix: restore null system operator for order logs
43a4171 feat frontend add service package publish page
618f4f0 fix backend service package credit score dto
```

冲突处理结果：

| 文件 | 原状态 | 当前状态 | 处理说明 |
|---|---|---|---|
| `backend/src/main/java/com/action/camera/common/config/WebMvcConfig.java` | `UU` | 已 `git add` 标记解决 | 不再全局排除 `/moments/**` 和 `/demands/**`，保留鉴权保护 |

## 11.2 D 线实际模块清单

| 模块 | 文件路径 | 当前已有功能 | 是否需要修复 |
|---|---|---|---|
| 评价 | `backend/src/main/java/com/action/camera/review/controller/ReviewController.java` | 创建评价、追评、按订单查询、按用户查询收到的可见评价 | 是 |
| 评价 | `backend/src/main/java/com/action/camera/review/service/ReviewService.java` | 订单参与方校验、完成/责任退款评价、评分影响信用、评价通知 | 是 |
| 评价 | `backend/src/main/java/com/action/camera/review/entity/Review.java` | `orderId/reviewerId/targetUserId/direction/rating/content/isVisible/replyContent` | 是 |
| 评价申诉 | `backend/src/main/java/com/action/camera/review/controller/ReviewComplaintController.java` | 提交、列表、详情、撤销、管理员列表、仲裁 | 是 |
| 评价申诉 | `backend/src/main/java/com/action/camera/review/service/ReviewComplaintService.java` | 被评价人申诉、申诉权限、管理员/仲裁员仲裁、隐藏评价、通知 | 是 |
| 信用 | `backend/src/main/java/com/action/camera/application/CreditService.java` | 更新信用分、限制 0-100、写信用流水、查询流水 | 是 |
| 信用 | `backend/src/main/java/com/action/camera/credit/controller/CreditController.java` | 查询信用摘要、查询信用流水 | 是 |
| 通知 | `backend/src/main/java/com/action/camera/notification/service/NotificationService.java` | 创建通知、查询我的通知、单条已读、全部已读 | 是 |
| 通知 | `backend/src/main/java/com/action/camera/notification/entity/Notification.java` | `userId/title/content/type/relatedType/relatedId/isRead/createdAt` | 是 |
| 测试 | `backend/src/test/java/com/action/camera/review/service/*`、`backend/src/test/java/com/action/camera/notification/service/*` | 覆盖基础评价、申诉、通知权限 | 是 |

## 11.3 D 线问题清单

| 编号 | 严重级别 | 模块 | 问题 | 文件路径 | 方法名 | 影响 | 建议修法 |
|---|---|---|---|---|---|---|---|
| D-001 | S1 | 评价 | 重复评价只靠服务层 `findByOrderIdAndDirection` 查询，实体和 SQL 未见 `UNIQUE(order_id, direction)` | `backend/src/main/java/com/action/camera/review/service/ReviewService.java:56`、`backend/src/main/java/com/action/camera/review/entity/Review.java:12` | `create` | 并发请求可能插入重复评价，重复影响信用分和通知 | 在 `reviews` 表加唯一约束；服务层捕获唯一键冲突并返回重复操作 |
| D-002 | S2 | 评价 | 首次评价正文无长度限制，且不 trim | `backend/src/main/java/com/action/camera/review/service/ReviewService.java:66`、`:196` | `validateRequest` | 超长正文可能写库失败或污染展示；只评分可保留，但最大 1000 字需限制 | 首评正文可选，非空时 trim，最多 1000 字 |
| D-003 | S3 | 评价 | 缺少单条评价详情接口 `GET /reviews/{reviewId}` | `backend/src/main/java/com/action/camera/review/controller/ReviewController.java` | 不存在 | 前端无法稳定进入评价详情；隐藏评价权限无法在单条维度表达 | 补充详情接口：公开可见评价可展示；隐藏评价仅订单双方和管理员可看 |
| D-004 | S2 | 评价 | `listByOrder` 返回订单下全部评价，未过滤隐藏评价给管理员/双方以外的场景 | `backend/src/main/java/com/action/camera/review/service/ReviewService.java:122` | `listByOrder` | 当前仅订单双方可看，普通外部用户不能看；但未来若订单评价页公开复用，隐藏评价可能泄露 | 明确接口用途；公开查询只返回 `isVisible=true`，详情再做权限分层 |
| D-005 | S2 | 评价申诉 | 同一评价重复申诉仅按 `reviewId + complainantId + PENDING/PROCESSING` 拦截，缺少数据库唯一/状态约束 | `backend/src/main/java/com/action/camera/review/service/ReviewComplaintService.java:74` | `create` | 并发可重复申诉；已取消/已处理后可再次申诉，产品口径不清 | 增加唯一/幂等策略；课程项目建议同一评价同一被评价人仅允许一个有效申诉 |
| D-006 | S3 | 评价申诉 | `PROCESSING` 只有枚举常量和判断，没有进入该状态的真实路径 | `backend/src/main/java/com/action/camera/review/service/ReviewComplaintService.java:28`、`:177` | `arbitrate` | 状态机复杂但不可达，后续测试/前端容易误判 | 最小化为 `PENDING -> RESOLVED/CANCELED`，或补充明确接单处理接口 |
| D-007 | S2 | 评价申诉 | 证据文件 ID 仅保存字符串，没有真实性和归属校验 | `backend/src/main/java/com/action/camera/review/service/ReviewComplaintService.java:86` | `create` | 用户可提交不存在或不属于自己的 fileId | D 线只定义 `file/` 模块校验契约，不直接改文件模块 |
| D-008 | S2 | 评价申诉 | 仲裁隐藏评价时按理论变化值反向冲销信用 | `backend/src/main/java/com/action/camera/review/service/ReviewComplaintService.java:195` | `arbitrate` | 99 分收到 5 星实际到 100，隐藏后按 -2 会变 98，不能恢复到 99 | 信用流水记录 `beforeScore/afterScore/appliedScoreChange/sourceType/sourceId`，回滚按实际生效值 |
| D-009 | S2 | 评价申诉 | 仲裁并发缺少行锁/状态版本控制，可能重复执行通知和信用调整 | `backend/src/main/java/com/action/camera/review/service/ReviewComplaintService.java:170` | `arbitrate` | 两个管理员并发处理同一申诉时存在重复副作用风险 | 对申诉行加锁或乐观锁；基于状态更新条件执行一次 |
| D-010 | S1 | 信用 | 信用分更新是读用户、内存计算、保存，缺少行锁/乐观锁/原子 SQL | `backend/src/main/java/com/action/camera/application/CreditService.java:39`、`:48` | `updateCreditScore` | 并发评价可能丢失更新，信用分和流水不一致 | 用行锁查询、乐观锁或原子 SQL 更新；流水记录真实 before/after |
| D-011 | S1 | 信用 | 信用流水缺少 `beforeScore`、实际生效变化值、来源类型/来源 ID 幂等键 | `backend/src/main/java/com/action/camera/domain/CreditRecord.java:29`、`:32` | `CreditRecord` | 无法准确回滚；同一评价可重复影响信用 | 增加/复用 `beforeScore/afterScore/appliedScoreChange/sourceType/sourceId`，加唯一来源键 |
| D-012 | S1 | 信用 | 信用详细流水接口允许任意登录用户查任意 `userId` | `backend/src/main/java/com/action/camera/credit/controller/CreditController.java:38` | `listCreditRecords` | 泄露信用变动原因和订单关联信息 | 摘要可公开；详细流水仅本人和管理员可查 |
| D-013 | S3 | 信用 | 信用摘要接口用户不存在时返回 `creditScore=null` 而非 404 | `backend/src/main/java/com/action/camera/credit/controller/CreditController.java:27` | `getCreditSummary` | 前端和调用方难以区分用户不存在/无分数 | 用户不存在返回 `NOT_FOUND` |
| D-014 | S2 | 通知 | 通知实体字段不足，缺少 `actorUserId/eventType/targetType/targetId/sourceType/sourceId/dedupeKey/metadataJson` | `backend/src/main/java/com/action/camera/notification/entity/Notification.java:21` | `Notification` | 无法统一承载需求、作品、聊天、报价、订单、交付、评价、系统事件 | 复用现有 `userId` 为 `recipientUserId`、`relatedType/relatedId` 迁移为 target 字段，补齐缺失字段 |
| D-015 | S2 | 通知 | 通知创建无去重键，评价/申诉/跨模块重试可能重复创建 | `backend/src/main/java/com/action/camera/notification/service/NotificationService.java:26` | `createNotification` | 重复通知、未读数膨胀 | 增加 `dedupeKey` 唯一约束和幂等创建 |
| D-016 | S3 | 通知 | 缺少分页、未读筛选和未读数量接口 | `backend/src/main/java/com/action/camera/notification/controller/NotificationController.java:24` | `listMine` | 通知列表增长后不可用；前端角标缺统一来源 | 增加 `GET /notifications?page&size`、`?isRead=false`、`GET /notifications/unread-count` |
| D-017 | S3 | 通知 | 聊天通知聚合和系统通知未读/会话未读分离未建模 | `backend/src/main/java/com/action/camera/notification/entity/Notification.java:14` | `Notification` | 新私信会造成通知泛滥或未读数混淆 | 提供聚合通知能力，按 `conversationId + recipientUserId` 更新摘要；聊天未读仍由 conversation/message 模块负责 |
| D-018 | S2 | 数据库迁移 | 未发现 D 线表的正式 SQL 迁移，`review_complaints` 只在测试里临时建表 | `backend/src/main/resources/db/`、`backend/src/test/java/com/action/camera/review/service/ReviewComplaintServiceTest.java` | `createComplaintTable` | 关闭 Hibernate DDL 后生产/演示库可能缺表或缺约束 | 补充 D 线数据库迁移草案，包含 reviews/complaints/credit/notifications 的约束和索引 |
| D-019 | S3 | 测试 | 已有测试覆盖基础流程，但缺并发、信用边界回滚、信用权限、通知分页/去重/未读数 | `backend/src/test/java/com/action/camera/review/service/ReviewServiceTest.java` 等 | 多个测试类 | 当前测试通过但不能证明核心风险已解决 | 按 11.11 补齐测试 |

## 11.4 通知覆盖矩阵

当前 `NotificationService.createNotification` 只能承载 `userId/title/content/type/relatedType/relatedId`，没有分页、去重、聚合、metadata。下表以现有模型能力为准。

| 业务来源 | 事件 | 接收人 | targetType | targetId | 当前是否支持 | 是否需要其他模块接入 |
|---|---|---|---|---|---|---|
| 需求大厅 | 摄影师响应需求 | 需求发布者 | `DEMAND` | demandId | 部分支持，当前只能用 `relatedType/relatedId` 简化表达 | 是，B 线 |
| 需求大厅 | 接受/拒绝响应、取消、过期、关闭 | 相关摄影师/发布者 | `DEMAND` / `CONVERSATION` | demandId/conversationId | 部分支持，缺事件规范和去重 | 是，B 线 |
| 橱窗与作品 | 评论作品、回复评论 | 摄影师/被回复者 | `SHOWCASE` | showcaseId | 部分支持，缺 actor 和 source | 是，B 或对应负责人 |
| 橱窗与作品 | 动态点赞、橱窗审核结果 | 动态作者/摄影师 | `DYNAMIC` / `SHOWCASE` | 对象 ID | 部分支持，缺聚合/审核事件规范 | 是，B/A |
| 聊天会话 | 新私信、聚合私信、会话创建 | 消息接收者/双方 | `CONVERSATION` | conversationId | 不完整，缺聚合字段和未读分离 | 是，C 线 |
| 报价 | 发送、确认、拒绝、撤回、过期 | 报价双方 | `QUOTE` / `CONVERSATION` / `ORDER` | quoteId/conversationId/orderId | 部分支持，缺报价卡片定位 metadata | 是，C 线 |
| 订单 | 支付、待拍摄、待交付、完成、取消、退款、申诉 | 订单双方 | `ORDER` | orderId | 部分支持，但存在旧档期文案 | 是，C 线 |
| 交付 | 上传、确认、返修、重传、即将超期、自动退款 | 双方 | `DELIVERY` / `ORDER` | deliveryId/orderId | 部分支持 | 是，C 线 |
| 评价与申诉 | 收到评价、收到追评、提交/撤回申诉、仲裁结果 | 评价相关用户 | `REVIEW` / `REVIEW_COMPLAINT` | reviewId/complaintId | 部分支持，当前评价通知 target 到 orderId，申诉 target 到 complaintId | D 线负责 |
| 系统 | 认证结果、平台公告 | 指定用户或全体用户 | `SYSTEM` | 业务对象 ID | 部分支持；认证已有调用，公告未审查 | 是，A/管理员 |

## 11.5 通知实体字段差异表

| 字段 | 当前是否存在 | 是否需要新增 | 原因 |
|---|---:|---:|---|
| `recipientUserId` | 否，当前为 `userId` | 否/迁移命名 | 可复用 `userId`，建议统一命名或 DTO 映射为接收者 |
| `actorUserId` | 否 | 是 | 需要记录触发者 |
| `type` | 是 | 否 | 当前存在，但更像 eventType，需明确大分类还是事件 |
| `eventType` | 否 | 是 | 需要具体业务事件 |
| `title` | 是 | 否 | 已存在 |
| `content` | 是 | 否 | 已存在 |
| `isRead` | 是 | 否 | 已存在 |
| `createdAt` | 是 | 否 | 已存在 |
| `targetType` | 否，当前为 `relatedType` | 否/迁移命名 | 可复用或迁移 `relatedType` |
| `targetId` | 否，当前为 `relatedId` | 否/迁移命名 | 可复用或迁移 `relatedId` |
| `sourceType` | 否 | 是 | 支持来源幂等和审计 |
| `sourceId` | 否 | 是 | 支持来源幂等和审计 |
| `dedupeKey` | 否 | 是 | 防止重复通知 |
| `metadataJson` | 否 | 是 | 聊天摘要、未读数、报价卡片锚点等扩展信息 |

## 11.6 通知接口差异表

| 接口 | 当前是否存在 | 是否建议补充 | 优先级 |
|---|---:|---:|---|
| `GET /notifications?page=0&size=20` | 否，当前 `GET /notifications` 返回全量列表 | 是 | S3 |
| `GET /notifications?isRead=false&page=0&size=20` | 否 | 是 | S3 |
| `GET /notifications/unread-count` | 否 | 是 | S2 |
| `PATCH /notifications/{notificationId}/read` | 是 | 保留 | S2 |
| `PATCH /notifications/read-all` | 是 | 保留，建议返回数量或空响应 | S3 |

## 11.7 跨模块问题清单

| 编号 | 问题 | 所属模块 | 证据文件 | 建议负责人 | D 线是否被阻塞 |
|---|---|---|---|---|---|
| X-001 | 订单通知仍出现旧档期文案：`schedule has been locked/released` | `order/` | `backend/src/main/java/com/action/camera/order/service/OrderService.java:666`、`:681` | C | 否，D 可先提供新通知契约 |
| X-002 | 仍有 `temporary_schedule_hold_id` 和 `scheduleHoldId` 概念 | `servicepackage/`、DB | `backend/src/main/java/com/action/camera/servicepackage/domain/ServicePackage.java:104`、`backend/src/main/resources/db/b1_b2_persistence.sql:26` | B/项目负责人 | 否，需记录产品决策 |
| X-003 | 证据文件真实性/归属校验需要文件模块接口 | `file/` | `ReviewComplaintService.create` 只保存字符串 | A 统筹 | 是，若要上线申诉证据校验 |
| X-004 | 聊天通知聚合需要会话/消息模块提供 unread 和 preview 契约 | `message/conversation/` | 通知实体缺 `metadataJson`，消息模块未审查 | C | 否，D 可先提供接口 |
| X-005 | 报价、订单、交付等跨模块通知调用当前只能传简化 `relatedType/relatedId` | `quote/order/delivery/` | `NotificationCreateRequest` 缺 target/source/dedupe/metadata | C | 否 |
| X-006 | 当前分支混入前端、Moments/social 和文档改动 | 多模块 | `git status --short` | 当前分支负责人 | 是，不建议直接修复 |

## 11.8 D 线允许修改的文件清单

| 文件路径 | 修改原因 | 是否属于 D 线 | 是否需要数据库迁移 | 风险 |
|---|---|---|---|---|
| `backend/src/main/java/com/action/camera/review/**` | 评价、追评、申诉状态、权限、信用回滚 | 是 | 可能需要 | 中 |
| `backend/src/main/java/com/action/camera/credit/**` | 信用接口权限、DTO 调整 | 是 | 可能需要 | 中 |
| `backend/src/main/java/com/action/camera/application/CreditService.java` | 原子更新、幂等、实际变更记录 | 是 | 是 | 高 |
| `backend/src/main/java/com/action/camera/domain/CreditRecord.java` | 信用流水字段补齐 | 是 | 是 | 中 |
| `backend/src/main/java/com/action/camera/repository/CreditRecordRepository.java` | 来源幂等查询/约束配合 | 是 | 是 | 中 |
| `backend/src/main/java/com/action/camera/notification/**` | 通知实体、服务、接口、去重、分页、聚合 | 是 | 是 | 中 |
| `backend/src/test/java/com/action/camera/review/**` | 评价/申诉测试补齐 | 是 | 否 | 低 |
| `backend/src/test/java/com/action/camera/notification/**` | 通知测试补齐 | 是 | 否 | 低 |
| `backend/src/test/java/com/action/camera/credit/**` | 信用测试补齐 | 是 | 否 | 低 |
| `docs/D-line-backend-fix-plan.md` | 本报告 | 是 | 否 | 低 |

## 11.9 禁止修改的文件清单

本轮发现但不应由 D 线直接修改的文件/目录：

```text
frontend/**
backend/src/main/java/com/action/camera/order/**
backend/src/main/java/com/action/camera/message/**
backend/src/main/java/com/action/camera/delivery/**
backend/src/main/java/com/action/camera/demand/**
backend/src/main/java/com/action/camera/servicepackage/**
backend/src/main/java/com/action/camera/social/**
backend/src/main/java/com/action/camera/admin/**
backend/src/main/java/com/action/camera/certification/**
backend/src/main/java/com/action/camera/controller/FileController.java
backend/src/main/java/com/action/camera/application/FileService.java
README*
Portra_*.html
portra_*.html
docs/D-line-frontend-*.md
docs/MOMENTS_*.md
```

`backend/src/main/java/com/action/camera/common/config/WebMvcConfig.java` 已因用户要求先解决冲突完成最小合并；后续 D 线业务修复不应继续改公共配置，除非 A 线/项目负责人确认。

## 11.10 数据库迁移草案

只写草案，不执行：

```sql
-- reviews: 防重复评价
ALTER TABLE reviews
  ADD UNIQUE KEY uk_reviews_order_direction (order_id, direction);

-- review_complaints: 查询与状态索引；是否唯一按产品口径确认
ALTER TABLE review_complaints
  ADD KEY idx_review_complaints_review_status (review_id, status),
  ADD KEY idx_review_complaints_complainant_status (complainant_id, status),
  ADD KEY idx_review_complaints_status_created (status, created_at);

-- credit_records: 记录实际生效变化和来源幂等
ALTER TABLE credit_records
  ADD COLUMN before_score DECIMAL(5,2) NULL,
  ADD COLUMN after_score DECIMAL(5,2) NULL,
  ADD COLUMN applied_score_change INT NULL,
  ADD COLUMN source_type VARCHAR(40) NULL,
  ADD COLUMN source_id BIGINT NULL,
  ADD UNIQUE KEY uk_credit_records_source (source_type, source_id),
  ADD KEY idx_credit_records_user_created (user_id, created_at);

-- notifications: 统一通知中心字段
ALTER TABLE notifications
  ADD COLUMN actor_user_id BIGINT NULL,
  ADD COLUMN event_type VARCHAR(60) NULL,
  ADD COLUMN target_type VARCHAR(40) NULL,
  ADD COLUMN target_id BIGINT NULL,
  ADD COLUMN source_type VARCHAR(40) NULL,
  ADD COLUMN source_id BIGINT NULL,
  ADD COLUMN dedupe_key VARCHAR(160) NULL,
  ADD COLUMN metadata_json TEXT NULL,
  ADD UNIQUE KEY uk_notifications_dedupe (dedupe_key),
  ADD KEY idx_notifications_recipient_read_created (user_id, is_read, created_at),
  ADD KEY idx_notifications_target (target_type, target_id);
```

聊天聚合通知如纳入通知表，需要确认是否在 `metadata_json` 保存 `conversationId/senderId/senderName/messagePreview/unreadMessageCount`，或拆出专门聚合字段。D 线不直接修改聊天模块。

## 11.11 测试计划

评价：

```text
重复评价
并发重复评价
首评正文为空允许
首评正文超过 1000 字拒绝
追评一次
重复追评
隐藏评价
隐藏评价权限
单条评价详情权限
```

信用：

```text
5 星加分
1 星扣分
信用上限 100
信用下限 0
99 分收到 5 星后隐藏应恢复 99
并发评价更新
重复评价不重复影响信用
详细流水仅本人/管理员可查
同一 sourceType/sourceId 幂等
```

通知基础：

```text
只能查询自己的通知
不能标记别人的通知
单条已读
全部已读
未读数量
分页
只看未读
旧档期文案清理
通知去重
dedupeKey 重试幂等
```

聊天通知：

```text
单条消息提醒
同会话多条消息聚合
不同会话分别聚合
聊天未读与系统通知未读分开
免打扰不清理历史未读
点击通知跳到对应 conversationId
```

业务通知覆盖：

```text
需求响应通知
接受响应通知
橱窗评论通知
动态点赞通知
发送报价通知
确认报价通知
订单支付通知
待交付通知
交付上传通知
返修通知
完成通知
收到评价通知
收到追评通知
申诉结果通知
认证结果通知
```

评价申诉：

```text
仅被评价人可以申诉
重复申诉被拒绝
撤销申诉
仲裁隐藏评价
仲裁驳回
重复仲裁被拒绝
信用准确回滚
证据文件不存在拒绝
证据文件不属于当前用户拒绝
```

已运行并通过：

```text
mvn -q "-Dtest=ReviewServiceTest,ReviewComplaintServiceTest,NotificationServiceTest" test
```

## 11.12 推荐修复顺序

```text
第一批：先从当前 feature/d/frontend 分支隔离出干净 D 线后端修复分支，避免混入前端/Moments/social 改动。
第二批：D 线 S1/S2 数据正确性问题：评价唯一约束、信用原子更新、信用实际生效变化值、来源幂等。
第三批：D 线权限问题：信用详细流水、评价详情/隐藏评价、申诉证据校验契约。
第四批：统一通知实体与接口：target/source/dedupe/metadata、分页、未读数。
第五批：评价、信用、通知测试补齐，尤其并发和边界回滚。
第六批：跨模块通知接入契约，交给 A/B/C 在各自业务节点调用。
第七批：A/B/C 协调事项：旧档期文案、文件归属校验、聊天聚合、订单/报价/交付通知接入。
```

## 需要其他成员协助

```text
需要其他成员协助：
1. 涉及文件：backend/src/main/java/com/action/camera/controller/FileController.java、backend/src/main/java/com/action/camera/application/FileService.java
2. 所属模块：file/
3. 当前问题：评价申诉证据只保存 evidenceFileIds 字符串，D 线无法确认文件存在性、可访问性和归属。
4. D 线需要的接口契约：validateOwnedFiles(userId, fileIds, bizType) 或等价只读校验接口。
5. 建议负责人：A 统筹。
6. 是否阻塞 D 线：阻塞“证据强校验”，不阻塞其他评价/信用/通知修复。
```

```text
需要其他成员协助：
1. 涉及文件：backend/src/main/java/com/action/camera/order/service/OrderService.java
2. 所属模块：order/
3. 当前问题：订单通知仍有 schedule locked/released 旧档期文案。
4. D 线需要的接口契约：订单模块调用统一 NotificationService 时使用 ORDER 状态事件和新文案。
5. 建议负责人：C。
6. 是否阻塞 D 线：不阻塞 D 线通知能力建设，阻塞旧文案彻底清理。
```

## 最终判断

冲突已解决，D 线后端审查已完成，现有 D 线测试通过。当前实现可跑通基础流程，但存在并发重复评价、信用回滚不准确、信用流水越权、通知模型不足、正式迁移缺失等必须在演示/提交前规划修复的问题。建议不要在当前混杂分支直接修复，先隔离干净 D 线后端分支后按 11.12 执行。
