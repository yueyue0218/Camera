# C 线需要修改项与 D 线接口交付说明

生成时间：2026-06-05
当前分支：feature/d-backend-fix
当前提交：5d58e29
阶段：阶段 7 - D 线后端分阶段修复完成，等待确认提交

## 1. D 线已具备能力

### 1.1 评价入口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/orders/{orderId}/reviews` | 订单评价。 |
| `GET` | `/orders/{orderId}/reviews` | 订单评价列表。 |
| `GET` | `/reviews/{reviewId}` | 评价详情，评价通知统一跳转目标。 |
| `POST` | `/reviews/{reviewId}/follow-up` | 原评价人追评。 |
| `GET` | `/users/{userId}/reviews` | 用户收到的可见评价。 |

当前 `ReviewResponse` 字段：

`reviewId, orderId, reviewerId, targetUserId, direction, rating, content, isVisible, createdAt, replyContent, replyTime, complaintStatus`

说明：

- `targetUserId` 即评价详情页的被评价人 ID。
- `replyContent/replyTime` 即追评内容和追评时间。
- `complaintStatus` 仅评价双方和 ADMIN 可见；无关用户查看公开评价时返回 `null`。

### 1.2 评价申诉入口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/reviews/{reviewId}/complaints` | 被评价人提交评价申诉。 |
| `GET` | `/reviews/complaints/my` | 我的评价申诉。 |
| `GET` | `/reviews/complaints/{complaintId}` | 评价申诉详情。 |
| `GET` | `/reviews/{reviewId}/complaints` | 评价关联申诉。 |
| `POST` | `/reviews/complaints/{complaintId}/cancel` | 取消待处理申诉。 |
| `GET` | `/admin/review-complaints` | 管理端列表。 |
| `PATCH` | `/admin/review-complaints/{complaintId}/arbitration` | 管理端裁定。 |

`evidenceFileIds` 仍为字符串字段，但 D 线已在提交评价申诉时完成基础校验。

当前契约：

- 空值允许，保存为 `null`。
- 非空值必须是英文逗号分隔的正整数，例如 `101,102`。
- 最多 5 个。
- 不允许重复。
- 文件必须存在。
- 文件上传者必须是当前申诉人。
- 文件 MIME 必须为 `image/*` 或 `application/pdf`。
- 保存前会标准化为 `id1,id2`，去除空格。

当前文件模块限制：

- `FileRecord` 当前没有 `deleted/deletedAt/status` 字段，D 线无法真实校验“文件未删除”。
- 当前校验通过 D 线 `EvidenceFileQueryPort` 读取 `FileRepository`，未修改 `file/**`。
- 如果 A/C 后续补充文件删除、软删除、病毒扫描、引用授权等能力，只需替换/扩展 D 线 Port 适配器。

### 1.3 通知接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/notifications?page=0&size=20` | 我的通知分页列表。 |
| `GET` | `/notifications?isRead=false&page=0&size=20` | 我的未读通知分页列表。 |
| `GET` | `/notifications/unread-count` | 系统通知未读数。 |
| `PATCH` | `/notifications/{notificationId}/read` | 标记单条通知已读。 |
| `PATCH` | `/notifications/read-all` | 标记全部通知已读。 |

当前 `NotificationResponse` 字段：

`notificationId, recipientUserId, actorUserId, title, content, type, eventType, relatedType, relatedId, targetType, targetId, sourceType, sourceId, dedupeKey, metadataJson, isRead, createdAt`

D 线后续阶段会保证通知跳转契约至少覆盖：

| 类型 | ID | 页面 |
| --- | --- | --- |
| `ORDER` | `orderId` | `/orders/{orderId}` |
| `DISPUTE` | `disputeId` | `/orders/{orderId}?tab=dispute` |
| `REVIEW` | `reviewId` | `/reviews/{reviewId}` |
| `REVIEW_COMPLAINT` | `complaintId` | `/review-complaints/{complaintId}` |
| `CONVERSATION` | `conversationId` | `/conversations/{conversationId}` |
| `QUOTE` | `quoteId` | 会话详情报价卡片 |
| `DELIVERY` | `deliveryId` 或 `orderId` | 订单详情交付区域 |

注意：路径以真实前端路由为准；不存在时只作为建议，不由 D 线修改前端。

### 1.4 订单申诉接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/orders/{orderId}/disputes` | 创建订单申诉。 |
| `POST` | `/disputes/{disputeId}/replies` | 订单申诉回复。 |
| `GET` | `/disputes/{disputeId}` | 订单申诉详情。 |
| `GET` | `/orders/{orderId}/disputes` | 订单申诉列表。 |
| `PATCH` | `/admin/disputes/{disputeId}/arbitration` | 管理端裁定。 |

当前 `DisputeArbitrateRequest` 字段：

`resolution, responsibility, refundAmount, comment`

其中：

- `FULL_REFUND / PARTIAL_REFUND`：`responsibility` 必填，且不能为 `NONE`。
- `PARTIAL_REFUND`：`refundAmount` 必填且大于 0。
- `REJECTED / REWORK`：`responsibility/refundAmount` 不生效，D 线记录中置空。
- 不直接修改 `order/**`、订单退款金额落库、订单状态机、返修流转。

支持的 `responsibility`：

`PROVIDER_FAULT, CUSTOMER_FAULT, BOTH_FAULT, NO_FAULT`

当前 `DisputeResponse` 已返回：

`id, orderId, initiatorId, reason, status, resolution, responsibility, refundAmount, adminId, adminComment, createdAt, updatedAt, resolvedAt, replies`

注意：

- `refundAmount` 当前由 D 线记录在申诉裁定记录中。
- C 线仍需负责订单侧退款金额、退款时间、退款原因、订单状态迁移和状态日志的最终落库。

## 2. C 线必须修改/确认内容

### 2.1 订单退款字段拆分

已确认规则：`refundStatus` 与 `refundResponsibility` 分开。

C 线订单快照需要提供：

`orderId, customerId, providerId, status, refundStatus, refundResponsibility`

建议含义：

- `refundStatus` 表达退款处理状态，例如 `NONE / REFUNDED / PARTIAL`。
- `refundResponsibility` 表达责任归属，例如 `PROVIDER_FAULT / CUSTOMER_FAULT / BOTH_FAULT / MUTUAL_AGREEMENT / NO_FAULT / UNDETERMINED`。

D 线评价会按责任归属决定退款后是否允许评价。

### 2.2 PARTIAL_REFUND 金额

已确认规则：`PARTIAL_REFUND` 必须记录具体 `refundAmount`。

C 线需要保存：

- 退款金额 `refundAmount`
- 退款原因
- 退款时间
- 仲裁结果对应订单状态迁移记录

D 线可在争议裁定 DTO 中提供 `refundAmount`，但不越界修改订单金额落库。

### 2.3 订单详情申诉区域

已确认第一版跳转：

`/orders/{orderId}?tab=dispute`

C 线需要在订单详情页支持：

- 申诉 tab/区域定位
- 展示 `GET /orders/{orderId}/disputes`
- 支持查看申诉详情和回复入口
- 根据订单状态展示“发起申诉”入口

### 2.4 订单详情评价入口

C 线需要在订单详情页支持：

- `COMPLETED` 后展示“去评价 / 查看评价”
- 责任明确退款后展示允许方评价入口
- 调用 `GET /orders/{orderId}/reviews`
- 评价详情通知跳 `/reviews/{reviewId}`；如果前端没有该路由，需要新增或映射到现有详情页

### 2.5 通知与聊天未读分离

已确认规则：`conversationUnreadCount` 与 `notificationUnreadCount` 分开统计。

C 线需要：

- 不把聊天未读混入 `/notifications/unread-count`
- 单独设计/实现会话未读数
- 新聊天消息、发送报价、确认报价、拒绝报价、报价过期等会话事件，如需系统通知，需要明确是否生成 D 线通知

### 2.6 旧档期文案

已确认不恢复精确档期系统，不新增 `Schedule` 表。

C 线需要清理或确认订单相关旧文案，例如：

- `schedule has been locked`
- `schedule slots have been released`

D 线不修改 `order/**`。

### 2.7 PRIVATE 交付文件下载权限与文件状态能力

C 线/文件模块需要确认：

- 私有交付文件下载权限
- 订单双方访问规则
- 申诉证据文件引用权限
- 文件删除/不可用状态的校验接口或字段，例如 `deleted`、`deletedAt`、`status`

D 线阶段 4 已新增 `EvidenceFileQueryPort` 并接入当前 `FileRepository`。当前可以校验存在性、上传者归属和 MIME；删除状态仍需文件模块提供。

## 3. A 线必须确认内容

- 仲裁权限已统一为 `ADMIN`，`ARBITRATOR` 当前不可仲裁。
- 不修改全局鉴权、不删除角色枚举。
- 管理后台如果仍展示 `ARBITRATOR` 仲裁入口，需要同步调整权限提示。

## 4. D 线待完成阶段

| 阶段 | 内容 | 是否越界 |
| --- | --- | --- |
| 阶段 2 | 通知后端基础能力与跳转契约补测试 | 已完成。 |
| 阶段 3 | 核对评价详情接口 DTO、权限、测试 | 已完成。 |
| 阶段 4 | 评价申诉证据文件校验 Port/契约 | 已完成；未改 `file/**`。 |
| 阶段 5 | 仲裁权限统一为 `ADMIN` | 已完成。 |
| 阶段 6 | 订单申诉 D 线侧契约：责任、金额、并发风险 | 已完成；未改 `order/**`。 |
| 阶段 7 | 测试与最终交付文档 | 已完成；未提交、未 push。 |

## 5. C 线后端需触发或承载的 D 线通知节点

需要 C 线确认是否生成 D 线通知或只作为 C 线内部消息：

- 会话创建
- 新聊天消息
- 发送报价
- 确认报价
- 拒绝报价
- 报价过期
- 订单创建
- 支付成功
- 进入待交付
- 上传交付
- 重新上传
- 要求返修
- 订单完成
- 订单取消
- 退款
- 自动确认完成
- 超期未交付自动退款
- 订单申诉相关状态变化

## 6. D 线本轮已完成

- 通知跳转契约：`DISPUTE` 通知携带 `metadataJson={"orderId":...}`。
- 评价详情：`GET /reviews/{reviewId}` 增加 `complaintStatus`，隐藏评价 ADMIN 可看。
- 评价申诉证据：校验最多 5 个、不重复、文件存在、上传者归属、图片/PDF。
- 仲裁权限：评价申诉仲裁统一为 `ADMIN`。
- 订单申诉 DTO：补 `responsibility/refundAmount`，并校验退款裁定规则。
- 测试：`mvn test` 通过，389 tests，0 failures，0 errors。

## 7. C/A/文件模块仍需完成

- C 线订单：订单实体和 DTO 拆分 `refundStatus/refundResponsibility`，并保存 `refundAmount/refundReason/refundedAt`。
- C 线订单：实现 `FULL_REFUND/PARTIAL_REFUND/REWORK/REJECTED` 对订单状态、金额和日志的最终迁移规则。
- C 线前端：订单详情支持申诉区域落点，真实路由需兼容 `/orders/{orderId}?tab=dispute` 或等价路径。
- C 线消息：实现 `conversationUnreadCount`，不要复用 D 线系统通知未读数。
- C 线订单文案：清理旧档期锁定/释放文案。
- 文件模块：补 PRIVATE 下载权限和文件删除/不可用状态能力。
- 数据库迁移：生产库需新增 `disputes.responsibility`、`disputes.refund_amount` 字段。
