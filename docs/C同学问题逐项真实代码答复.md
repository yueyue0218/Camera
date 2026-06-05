# C 同学问题逐项真实代码答复

生成时间：2026-06-05

核查基准：

- 后端修复工作树：`C:\Users\LiXiaozhou\Camera-d-backend-fix`
- 当前分支：`feature/d-backend-fix`
- 当前基线：`origin/dev`，HEAD `5d58e29`
- 已包含本工作树当前阶段 2 的本地改动：`DISPUTE` 通知已补 `targetType/targetId/metadataJson`
- 前端路由核查来源：原工作区 `C:\Users\LiXiaozhou\Camera\frontend`，因为后端修复工作树来自 `origin/dev`，不包含 `frontend/src`

本文件只回答接口和契约问题，不代表已完成全部代码修改。涉及 `order/**`、`file/**`、`message/**`、前端的内容均按真实代码标注为 C/A/对应模块待改，不由 D 线越界实现。

## 1. 最终退款字段

### 最终建议字段

按已确认规则，订单侧最终应拆成以下字段。金额字段建议沿用当前代码库的 `*Cent` 金额惯例，避免“元/分”歧义。

| 语义 | 建议 Java 字段 | Java 类型 | 建议数据库字段 | 建议值/说明 |
| --- | --- | --- | --- | --- |
| 退款状态 | `refundStatus` | `String`，或 C 线自定义枚举 | `refund_status` | `NONE`、`PARTIAL`、`FULL` |
| 退款责任 | `refundResponsibility` | `String`，或 C 线自定义枚举 | `refund_responsibility` | `NONE`、`PROVIDER_FAULT`、`CUSTOMER_FAULT`、`BOTH_FAULT`、`NO_FAULT` |
| 退款金额 | `refundAmountCent` | `Long` | `refund_amount` | 单位分；DB 如沿用现有金额列风格，可用 decimal 并配 `CentToYuanConverter` |
| 退款原因 | `refundReason` | `String` | `refund_reason` | 仲裁/取消/自动退款原因 |
| 退款时间 | `refundedAt` | `LocalDateTime` | `refunded_at` | 退款完成时间 |

如果 C 线坚持字段名 `refundAmount`，必须明确单位。D 线建议 Java/DTO 使用 `refundAmountCent`。

### 当前订单实体实际字段

`backend/src/main/java/com/action/camera/order/entity/Order.java` 当前已有：

| 当前字段 | Java 类型 | DB 字段 | 当前语义 |
| --- | --- | --- | --- |
| `refundStatus` | `String` | `refund_status` | 默认 `NONE`；当前代码使用 `REFUNDED`，争议部分退款临时写 `PARTIAL` |
| `completeTime` | `LocalDateTime` | `complete_time` | 完成时间 |
| `cancelTime` | `LocalDateTime` | `cancel_time` | 取消时间 |

当前没有：

- `refundResponsibility`
- `refundAmountCent` / `refundAmount`
- `refundReason`
- `refundedAt`

退款金额和退款时间目前在 `PaymentRecord`：

| 当前字段 | Java 类型 | DB 字段 |
| --- | --- | --- |
| `refundAmountCent` | `Long` | `refund_amount` |
| `refundedAt` | `LocalDateTime` | `refunded_at` |

### 旧字段迁移

当前 `refundStatus` 不是 Java 枚举，是 `String`。但旧值语义混杂：

- `NONE`
- `REFUNDED`
- `PARTIAL`
- 评价逻辑还从 `refundStatus` 里读取责任值，例如 `PROVIDER_FAULT`、`REFUNDED_PROVIDER_FAULT`

最终需要迁移或替换：

- `refund_status=REFUNDED` 迁为 `refund_status=FULL`
- `refund_status=PARTIAL` 保留为 `PARTIAL`
- 责任类值迁到 `refund_responsibility`
- D 线评价不应再从 `refundStatus` 推断责任，应从 `refundResponsibility` 读取

### 对 DTO 和前端影响

会影响。当前 `OrderResponse` 只有：

`refundStatus`

需要 C 线扩展：

`refundStatus, refundResponsibility, refundAmountCent, refundReason, refundedAt`

订单详情页如果要展示退款信息，也必须同步读这些字段。

## 2. PARTIAL_REFUND 后订单状态

最终结论：

- `PARTIAL_REFUND` 后 `order.status` 仍使用 `REFUNDED`
- 不新增单独的部分退款订单状态
- 全额/部分退款通过 `refundStatus` 区分：`FULL` vs `PARTIAL`
- 订单详情需要显示：`refundAmountCent/refundAmount`、`refundResponsibility`、`refundReason`、`refundedAt`

当前实际实现：

- `DisputeService.resolveTargetStatus()` 当前把 `FULL_REFUND` 和 `PARTIAL_REFUND` 都映射为 `OrderStatus.REFUNDED`
- `PARTIAL_REFUND` 当前额外执行 `order.setRefundStatus("PARTIAL")`
- 当前没有保存部分退款金额
- 当前全额退款由 `OrderService.markRefunded()` 把 `refundStatus` 写成 `REFUNDED`

需要改：

- C 线订单字段需要支持 `refundStatus=FULL/PARTIAL`
- D 线争议 DTO 阶段 6 需要补 `refundAmountCent/refundAmount`
- 订单落库、支付流水退款金额由 C 线/订单模块处理，不由 D 线直接改 `order/**`

## 3. 四种仲裁结果到订单状态

### 当前实际实现

`DisputeService.resolveTargetStatus()` 当前映射：

| 仲裁结果 | 当前订单状态 |
| --- | --- |
| `FULL_REFUND` | `REFUNDED` |
| `PARTIAL_REFUND` | `REFUNDED` |
| `REWORK` | `REWORK_REQUIRED` |
| `REJECTED` | `COMPLETED` |

当前问题：

- `REJECTED` 固定到 `COMPLETED`
- 没有保存申诉前状态
- 无法恢复到申诉前真实状态

### 最终建议

| 仲裁结果 | 最终建议 |
| --- | --- |
| `FULL_REFUND` | `order.status=REFUNDED`，`refundStatus=FULL`，责任必填 |
| `PARTIAL_REFUND` | `order.status=REFUNDED`，`refundStatus=PARTIAL`，`refundAmount` 必填，责任必填 |
| `REWORK` | `order.status=REWORK_REQUIRED` |
| `REJECTED` | 应恢复申诉前状态，不应固定 `COMPLETED` |

### REJECTED 后恢复规则

最终应恢复申诉前状态。当前代码没有 `previousOrderStatus` / `appealFromStatus` 字段，因此需要补。

建议在订单申诉记录中保存：

- `previousOrderStatus`
- 或 `appealFromStatus`

这样 `REJECTED` 可从 `APPEALING` 回到原状态。

### REWORK_REQUIRED 后续流程

当前已有真实实现：

- `DeliveryService.upload()` 在订单为 `REWORK_REQUIRED` 时，调用 `OrderService.completeReworkDelivery(...)`
- `OrderService.completeReworkDelivery(...)` 先执行 `REWORK_REQUIRED -> PENDING_DELIVERY`
- 再执行 `PENDING_DELIVERY -> DELIVERED_PENDING_CONFIRM`

因此返修再次交付沿用现有交付逻辑。

### 状态日志

当前 `OrderService.applyStatusChange(...)` 每次成功状态变化都会写 `order_status_logs`。

争议仲裁当前调用 `orderService.changeStatus(...)`，因此会记录状态日志。

`operatorRole` 当前规则：

- 优先取 `UserContext.getCurrentRole().name()`
- 若上下文角色为空，且 operator 是客户，写 `CUSTOMER`
- 若 operator 是服务方，写 `PROVIDER`
- 否则写 `SYSTEM`

最终建议：管理端仲裁请求应确保 `UserContext.currentRole=ADMIN`，状态日志写 `ADMIN`。如果直接在测试或后台任务中调用且无 UserContext，当前会写 `SYSTEM`。

## 4. 订单申诉真实接口

当前真实接口位于：

`backend/src/main/java/com/action/camera/dispute/controller/DisputeController.java`

### POST /orders/{orderId}/disputes

请求 DTO：

`DisputeCreateRequest(String reason)`

响应 DTO：

`DisputeResponse`

字段：

`id, orderId, initiatorId, reason, status, resolution, adminId, adminComment, createdAt, updatedAt, resolvedAt, replies`

权限：

- 当前登录用户必须是订单 `customerId` 或 `providerUserId`

允许订单状态：

- 当前代码显式拒绝：`COMPLETED`、`CANCELLED`、`REFUNDED`
- 然后调用 `OrderService.changeStatus(orderId, initiatorId, APPEALING, "用户发起申诉")`
- 受 `OrderStatusMachine` 限制，实际可从以下状态进入 `APPEALING`：
  - `PAID_PENDING_SHOOT`
  - `SHOOTING`
  - `PENDING_DELIVERY`
  - `DELIVERED_PENDING_CONFIRM`
  - `REWORK_REQUIRED`

允许 dispute 状态：

- 同一订单不能已有 `OPEN` 或 `REPLIED` 申诉

错误：

- `VALIDATION_ERROR`：reason 为空或超过 1000 字
- `FORBIDDEN`：非订单双方
- `STATUS_CONFLICT`：订单已结束或状态机不允许转 `APPEALING`
- `DUPLICATE_OPERATION`：已有进行中申诉
- `NOT_FOUND`：订单不存在

### GET /orders/{orderId}/disputes

请求 DTO：无

响应 DTO：

`List<DisputeResponse>`

权限：

- 订单双方或 `ADMIN`

错误：

- `FORBIDDEN`
- `NOT_FOUND`

### GET /disputes/{disputeId}

请求 DTO：无

响应 DTO：

`DisputeResponse`

权限：

- 订单双方或 `ADMIN`

错误：

- `FORBIDDEN`
- `NOT_FOUND`

### POST /disputes/{disputeId}/replies

请求 DTO：

`DisputeReplyRequest(String content)`

响应 DTO：

`DisputeResponse`

权限：

- 只有订单另一方可以回复
- 申诉发起人不能回复自己的申诉

允许 dispute 状态：

- 仅 `OPEN`

错误：

- `VALIDATION_ERROR`：content 为空或超过 2000 字
- `FORBIDDEN`
- `STATUS_CONFLICT`：非 `OPEN`
- `NOT_FOUND`

### PATCH /admin/disputes/{disputeId}/arbitration

请求 DTO：

`DisputeArbitrateRequest(String resolution, String comment)`

响应 DTO：

`DisputeResponse`

权限：

- 当前实际实现只允许用户 `currentRole=ADMIN`

允许 dispute 状态：

- `OPEN`
- `REPLIED`

支持 resolution：

- `FULL_REFUND`
- `PARTIAL_REFUND`
- `REJECTED`
- `REWORK`

错误：

- `FORBIDDEN`：非 ADMIN
- `VALIDATION_ERROR`：resolution 为空或不支持
- `STATUS_CONFLICT`：已结案
- `NOT_FOUND`

普通用户端只接前四个接口；`PATCH /admin/disputes/{disputeId}/arbitration` 不应放进普通用户页面。

## 5. 订单详情申诉落地点

后端 D 线同意第一版通知落到订单详情申诉区域。

目标语义：

`/orders/{orderId}?tab=dispute`

但当前原前端工作区真实路由是：

- `/orders`
- `/orders/:orderId/delivery`
- `/orders/:orderId/reviews`

当前 `OrdersPage` 实际通过 query 参数 `orderId` 聚焦订单：

`/orders?orderId={orderId}`

当前未看到：

- `/orders/:orderId` 独立详情路由
- `tab=dispute` 的 query 处理
- 订单申诉区域 UI

因此当前最兼容路径是：

`/orders?orderId={orderId}&tab=dispute`

如果 C 线要实现标准订单详情路由，则可按约定实现：

`/orders/{orderId}?tab=dispute`

通知点击后应：

1. 从通知 `metadataJson.orderId` 取订单 id
2. 跳转订单详情
3. 订单详情自动调用 `GET /orders/{orderId}/disputes`
4. 自动滚动或切换到申诉区域

## 6. DISPUTE 通知跳转字段

确认同意。

阶段 2 当前代码已实现：

```json
{
  "targetType": "DISPUTE",
  "targetId": 12,
  "metadataJson": "{\"orderId\":38}"
}
```

真实 `NotificationResponse` 字段是 `metadataJson` 字符串，不是对象字段 `metadata`。

当前争议通知实际字段：

- `type=DISPUTE_CREATED | DISPUTE_REPLIED | DISPUTE_RESOLVED`
- `eventType` 同 `type`
- `relatedType=DISPUTE`
- `relatedId=disputeId`
- `targetType=DISPUTE`
- `targetId=disputeId`
- `sourceType=DISPUTE`
- `sourceId=disputeId`
- `dedupeKey=dispute:{type}:{disputeId}:{userId}`
- `metadataJson={"orderId":<orderId>}`

前端点击建议：

`/orders/{orderId}?tab=dispute`

当前原前端路由未支持 `/orders/{orderId}` 时，临时使用：

`/orders?orderId={orderId}&tab=dispute`

## 7. GET /orders/{orderId}/reviews 返回结构

真实接口：

`GET /orders/{orderId}/reviews`

响应：

`Result<List<ReviewResponse>>`

`ReviewResponse` 字段：

```text
reviewId
orderId
reviewerId
targetUserId
direction
rating
content
isVisible
createdAt
replyContent
replyTime
```

权限：

- 必须登录
- 只有订单 `customerId` 或 `providerId` 可查看该订单评价

是否能回答 C 线问题：

| 问题 | 是否可由当前响应回答 |
| --- | --- |
| 当前用户是否已经评价 | 可以。看是否存在 `reviewerId == currentUserId` |
| reviewId 是多少 | 可以。字段 `reviewId` |
| 评价方向是什么 | 可以。字段 `direction` |
| 双方是否分别已经评价 | 可以。看是否有 `CUSTOMER_TO_PROVIDER` 和 `PROVIDER_TO_CUSTOMER` 两条 |

注意：

- 当前接口返回列表，不直接给 `myReviewed`、`counterpartReviewed` 这类布尔字段
- C 线订单详情需要自行按 `reviewerId/direction` 计算

## 8. GET /reviews/{reviewId} 是否存在

存在。

真实路径：

`GET /reviews/{reviewId}`

响应：

`Result<ReviewResponse>`

字段同第 7 点。

权限规则：

- 必须登录
- 可见评价：任意登录用户可看
- 隐藏评价：仅订单双方或 `ADMIN` 可看

隐藏评价是否可见：

- `isVisible=true`：正常返回
- `isVisible=false`：只有订单客户、服务方、`ADMIN` 返回；其他用户抛 `FORBIDDEN`

当前不足：

- `ReviewResponse` 没有 `complaintStatus`
- 如果评价详情页需要展示申诉状态，需要阶段 3/后续补充或前端另查申诉接口

## 9. 通知创建真实 Service 或 DTO

当前 C/D 后端是直接调用 `NotificationService`，没有统一事件消费机制。

真实 Service：

```java
NotificationResponse createNotification(NotificationCreateRequest request)
```

真实 DTO：

```java
public record NotificationCreateRequest(
    Long userId,
    Long actorUserId,
    String title,
    String content,
    String type,
    String eventType,
    String relatedType,
    Long relatedId,
    String targetType,
    Long targetId,
    String sourceType,
    Long sourceId,
    String dedupeKey,
    String metadataJson
)
```

兼容旧构造：

```java
new NotificationCreateRequest(
    Long userId,
    String title,
    String content,
    String type,
    String relatedType,
    Long relatedId
)
```

字段映射：

| 你们说法 | 当前真实字段 |
| --- | --- |
| receiverId | `userId` |
| eventType | `eventType`，旧代码常用 `type` 同步 |
| targetType | `targetType` |
| targetId | `targetId` |
| title | `title` |
| content | `content` |
| metadata | `metadataJson`，字符串 |
| dedupeKey | `dedupeKey` |

## 10. C 已接入的通知节点

| 业务节点 | 当前是否已有通知 | 代码位置 | 是否需要补 |
| --- | ---: | --- | ---: |
| 会话创建 | 部分有 | `DemandService.notifyConversationStarted`，仅接受需求响应后创建会话会通知 | 是，直接会话/其他来源会话需补 |
| 新聊天消息 | 无 | `MessageService.sendMessage` 只保存消息和 `lastMessageTime` | 是 |
| 发送报价 | 无 | `QuoteService.createQuoteFromConversation` 无通知 | 是 |
| 确认报价 | 无 | `QuoteService.confirmQuote` 只确认报价并生成订单 | 是 |
| 拒绝报价 | 无 | `QuoteService.rejectQuote` 只改报价状态 | 是 |
| 报价过期 | 无 | `QuoteService.confirmQuote` 中发现过期只写 `EXPIRED` 并抛错 | 是 |
| 订单创建 | 无 | `OrderService.createOrderFromConfirmedQuote` 只创建订单 | 是 |
| 支付成功 | 有 | `OrderService.notifyOrderPaid` | 否，文案需改 |
| 进入拍摄中 | 无 | `OrderService.changeStatus` 不对该状态发通知 | 是 |
| 进入待交付 | 无 | `OrderService.changeStatus/autoAdvanceShootingOrders` 不发通知 | 是 |
| 已交付待确认 | 有 | `DeliveryService.notifyDeliveryUploaded` | 可增强 target 为 DELIVERY/ORDER |
| 要求返修 | 无 | `OrderService.requestRework` 不发通知 | 是 |
| 订单完成 | 有 | `OrderService.notifyOrderCompleted`，只通知服务方 | 可确认是否也通知客户 |
| 订单取消 | 有 | `OrderService.notifyOrderCancelled` | 否，文案需改 |
| 退款完成 | 无专用通知 | 退款取消只走订单取消通知；争议退款只走 `DISPUTE_RESOLVED` | 是 |
| 进入 APPEALING | 有 | `DisputeService.createDispute` -> `DISPUTE_CREATED` | 否 |
| 自动确认完成 | 无 | `OrderService.autoConfirmTimeoutOrders` 直接 `applyStatusChange` | 是 |
| 超期未交付自动退款 | 无 | `OrderService.autoRefundOverdueUndeliveredOrders` 直接退款状态流转 | 是 |
| 首次上传交付 | 有 | `DeliveryService.notifyDeliveryUploaded` | 否 |
| 重新上传交付 | 有，未区分首次/重新 | 同上传入口 | 可补区分 |
| 临近交付截止 | 无 | 未见调度/通知 | 是 |

额外已接入但不在表中的通知：

- 需求响应接受：`DemandService.notifyResponseAccepted`
- 需求响应拒绝：`DemandService.notifyResponseRejected`
- 评价收到：`ReviewService.create`
- 追评收到：`ReviewService.followUp`
- 评价申诉创建/处理：`ReviewComplaintService`
- 动态点赞：`MomentService`
- 用户关注：`SocialRelationService`
- 认证审核：`AdminCertificationService`

## 11. 旧档期通知文案是否存在

存在。

真实位置：

`backend/src/main/java/com/action/camera/order/service/OrderService.java`

当前英文文案：

- `A customer has paid an order and the schedule has been locked.`
- `An order has been cancelled and related schedule slots have been released.`

未检到中文：

- `档期已经锁定`
- `档期已经释放`

按约定应由 C 线/order 模块改为：

- `客户已完成支付，订单已进入待拍摄状态。`
- `订单已取消。`

D 线不修改 `order/**`。

## 12. 聊天未读实现方案

当前实际实现：

1. 是否已有会话未读字段：没有。`Conversation` 只有 `lastMessageTime`，无 unread 字段。
2. 是否已有用户级会话读取状态：没有。只看到 `ConversationHiddenByUser` 用于隐藏会话，不是阅读状态。
3. 发送新消息时在哪里 `对方 unreadCount + 1`：当前没有实现。`MessageService.sendMessage` 只保存 `Message.isRead=false`。
4. 打开会话时在哪里 `当前用户 unreadCount = 0`：当前没有实现。`listMessages` 只读消息，不标记已读。
5. 会话列表是否返回 `unreadCount`：不返回。`ConversationListItemResponse` 字段只有 `conversationId, participantAId, participantBId, otherUserId, sourceType, sourceId, lastMessageTime, createdAt`。
6. 顶部消息导航能否展示聊天未读角标：当前后端没有数据支撑。

最终建议：

- `conversationUnreadCount` 与 `notificationUnreadCount` 分开
- C 线消息模块新增用户级会话读取状态，建议表/实体如 `conversation_read_states`
- 发送消息时增加接收方会话未读
- 打开会话或拉取消息后标记当前用户已读
- `GET /conversations` 返回 `unreadCount`
- 顶部“消息”角标读会话未读总数，不读 `/notifications/unread-count`

D 线通知抽屉只负责系统通知未读。

## 13. 订单快照真实 Service 或 Port

当前已有：

- `OrderQueryPort`
- `OrderSnapshot`
- `LocalOrderAdapter`
- `COrderHttpAdapter`

真实 Port：

```java
public interface OrderQueryPort {
    OrderSnapshot getOrderSnapshot(Long orderId);
}
```

真实 `OrderSnapshot` 字段：

```java
Long orderId
Long customerId
Long providerId
String status
String refundStatus
LocalDateTime deliveryDeadline
```

当前缺少：

- `refundResponsibility`
- `refundAmountCent` / `refundAmount`
- `refundReason`
- `refundedAt`
- `completeTime`

D 线当前调用：

- `ReviewService` 通过 `OrderQueryPort.getOrderSnapshot(orderId)` 读取订单快照
- `DeliveryService` 也使用 `OrderQueryPort`

订单快照修改责任：

- C 线负责扩展订单 DTO / `/orders/{orderId}` 响应
- D 线负责同步扩展 `OrderSnapshot`
- D 线负责同步 `LocalOrderAdapter` 和 `COrderHttpAdapter`
- 如果字段进入评价判断，D 线同步 `ReviewService`

## 14. D 调 C 订单迁移的方式

### 当前真实实现

当前是“直接调用 C 线订单服务 + 少量直接改订单仓储”的混合方式：

- `DisputeService.createDispute(...)` 调用：
  - `orderService.changeStatus(orderId, initiatorId, OrderStatus.APPEALING, "用户发起申诉")`
- `DisputeService.arbitrate(...)` 调用：
  - `orderService.changeStatus(dispute.getOrderId(), adminId, targetOrderStatus, "管理员裁定申诉，结果：" + resolution)`
- `PARTIAL_REFUND` 当前还直接：
  - `orderRepository.findById(...).ifPresent(o -> o.setRefundStatus("PARTIAL"))`
- 同时发布：
  - `new DisputeResolvedEvent(this, disputeId, orderId, resolution)`

但未发现 `DisputeResolvedEvent` 的消费者。

### 最终建议选择

建议采用方案 A 的受控版本：C 线提供明确的订单争议裁定 Service/Port，D 线调用，不再直接写 `orderRepository`。

建议接口：

```text
orderDisputeResolutionService.applyDisputeResolution(...)
```

或 Port：

```text
OrderDisputeResolutionPort.applyDisputeResolution(...)
```

输入字段建议：

```text
orderId
disputeId
resolution
responsibility
refundAmountCent
refundReason
operatorId
operatorRole=ADMIN
previousOrderStatus
```

事务边界：

- 同一服务事务内完成争议裁定和订单迁移
- 订单迁移失败时，争议裁定也应回滚
- 不建议用异步事件作为主路径，否则订单状态失败时争议可能已 RESOLVED

事件 `DisputeResolvedEvent` 可保留用于后置通知/审计/异步扩展，但不作为订单状态迁移主路径。

## 15. PRIVATE 文件下载权限负责人

当前真实下载接口：

`GET /files/{fileId}/download`

真实代码：

- `FileController.download(Long fileId)`
- `FileService.getById(fileId)`
- `fileStorage.load(record.getFileKey())`

当前权限：

- Controller 注释写“需登录”，但下载方法内部没有读取 `UserContext`
- 没有校验上传者
- 没有校验订单参与者
- 没有校验文件 `visibility=PRIVATE`
- 没有校验 delivery/order 关联
- 第三方只要拿到 fileId，在通过全局登录校验的前提下就可能下载

当前不支持：

- 仅订单客户下载
- 仅订单摄影师下载
- 管理员下载
- 第三方拒绝

负责人建议：

- 文件模块/公共后端负责人修 `file/**` 下载权限
- C 线提供订单参与者校验能力或订单-交付文件关联查询
- D 线不直接修改 `file/**`

最低权限规则：

- PUBLIC 文件按原公开规则
- PRIVATE + DELIVERY 文件：订单客户、订单服务方、ADMIN 可下载
- 第三方拒绝
- 评价申诉证据文件也应校验上传者/引用者权限

## 八、按编号简版结论

1. 最终退款字段：`refundStatus`、`refundResponsibility`、`refundAmountCent`、`refundReason`、`refundedAt`；当前订单只有旧 `refundStatus`，金额/时间在 `PaymentRecord`。
2. `PARTIAL_REFUND` 后订单状态：最终仍用 `order.status=REFUNDED`，通过 `refundStatus=PARTIAL` 和 `refundAmountCent` 区分。
3. `REJECTED` 后订单恢复规则：当前固定 `COMPLETED`；最终应恢复申诉前状态，需要保存 `previousOrderStatus`。
4. 订单申诉真实接口：`POST /orders/{orderId}/disputes`、`GET /orders/{orderId}/disputes`、`GET /disputes/{disputeId}`、`POST /disputes/{disputeId}/replies`、`PATCH /admin/disputes/{disputeId}/arbitration`。
5. 订单详情申诉落地点：目标 `/orders/{orderId}?tab=dispute`；当前原前端实际更兼容 `/orders?orderId={orderId}&tab=dispute`，且尚无 tab 支持。
6. `DISPUTE` 通知跳转字段：同意。当前已实现 `targetType=DISPUTE`、`targetId=disputeId`、`metadataJson={"orderId":orderId}`。
7. `GET /orders/{orderId}/reviews` 返回结构：`List<ReviewResponse>`，字段为 `reviewId/orderId/reviewerId/targetUserId/direction/rating/content/isVisible/createdAt/replyContent/replyTime`。
8. `GET /reviews/{reviewId}` 是否存在：存在；可见评价任意登录用户可看，隐藏评价仅订单双方和 ADMIN 可看。
9. 通知创建真实 Service 或 DTO：`NotificationService.createNotification(NotificationCreateRequest)`，DTO 字段见第 9 节。
10. C 已接入的通知节点：需求响应接受/拒绝、会话创建（需求接受路径）、交付上传、支付成功、订单取消、订单完成、评价/追评、评价申诉、订单申诉、social 点赞/关注已接；聊天消息、报价、订单创建、拍摄/待交付、返修、专用退款、自动确认、自动退款、临期提醒未接。
11. 旧档期文案是否存在：存在英文 `schedule has been locked/released`，在 `OrderService`。
12. 聊天未读实现方案：当前未实现；应由 C 线消息模块新增会话级/用户级未读状态，和系统通知未读分开。
13. 订单快照真实 Service 或 Port：已有 `OrderQueryPort.getOrderSnapshot(Long)` 和 `OrderSnapshot`，当前字段不足，需要补退款责任/金额/原因/时间/完成时间。
14. D 调 C 订单迁移的方式：当前直接调用 `OrderService.changeStatus` 并部分直接写 `OrderRepository`；最终建议 C 提供明确订单争议裁定 Service/Port，D 调用并同事务回滚。
15. PRIVATE 文件下载权限负责人：当前 `/files/{fileId}/download` 未做订单参与者/PRIVATE 校验；应由文件模块/公共后端与 C 线订单能力共同修，D 线不越界改 `file/**`。
