# D-line Backend Fix Progress

生成时间：2026-06-05

## 阶段状态

当前阶段：阶段 7 - 测试与最终交付文档已完成，等待确认提交
当前分支：feature/d-backend-fix
当前提交：5d58e29
基线：origin/dev

## 分支安全检查

已执行并确认：

- `git branch --show-current` -> `feature/d-backend-fix`
- `git status --short` -> 干净
- `git log --oneline --decorate -5` -> HEAD 为 `5d58e29 fix: complete d-line and social backend`

结论：当前是独立 D 线后端修复分支，不是 `dev/main/master`，不是前端分支，工作区干净，可以作为后续分阶段修复基线。

## 阶段 1 只读核查范围

依据文件：

- `C:\Users\LiXiaozhou\Camera\docs\C线对接D线接口真实核查报告.md`
- `C:\Users\LiXiaozhou\Camera\Codex-D线后端逐步修复指令.md`

本分支源码：

- `backend/src/main/java/com/action/camera/review/**`
- `backend/src/main/java/com/action/camera/credit/**`
- `backend/src/main/java/com/action/camera/notification/**`
- `backend/src/main/java/com/action/camera/dispute/**`
- `backend/src/main/java/com/action/camera/application/CreditService.java`
- `backend/src/test/java/com/action/camera/**`

## 差异核对结果

| 编号 | 状态 | 真实核查结论 | 后续阶段 |
| --- | --- | --- | --- |
| D-1 | 待修/跨 C | `ReviewService` 当前从 `OrderSnapshot.refundStatus` 推断责任；`DisputeService` 仅写 `REFUNDED` 或 `PARTIAL`，未区分 `refundResponsibility`。 | 阶段 6 先在 D 线争议 DTO/文档收敛契约；订单落库由 C 线处理。 |
| D-2 | 已完成/跨文件模块留项 | `ReviewComplaintCreateRequest.evidenceFileIds` 已校验格式、数量、重复、存在性、上传者归属和 MIME 类型；文件删除状态当前 `files` 表无字段，需文件模块补能力。 | 阶段 4 已完成。 |
| D-3 | 部分已具备 | `GET /reviews/{reviewId}` 已存在；`ReviewResponse` 含 `reviewId/orderId/...`。评价通知当前 target 可到 `REVIEW`，但仍需确认全部通知统一跳 `/reviews/{reviewId}`。 | 阶段 2/3 核对测试。 |
| D-4 | 待契约化 | 争议接口已存在；通知第一版应落 `/orders/{orderId}?tab=dispute`。当前争议通知旧构造只携带 `relatedType=DISPUTE, relatedId=disputeId`，未稳定携带 `orderId`。 | 阶段 2 或阶段 6。 |
| C-1 | C 线修改 | 后端 `/notifications` 已支持分页、`isRead` 和 unread-count；前端 API 封装不足不是 D 线后端修改范围。 | 写入交付说明。 |
| C-2 | C 线修改 | `conversationUnreadCount` 与 `notificationUnreadCount` 已确认必须分开；聊天未读不应混入 D 线通知未读。 | 写入交付说明。 |
| C-3 | C 线修改/文案 | 旧档期文案残留在订单通知中；指令禁止 D 线修改 `order/**`。 | 写入交付说明。 |
| A-1 | 已完成 | `ReviewComplaintService` 已从 `ADMIN/ARBITRATOR` 收敛为仅 `ADMIN`；`DisputeService` 已保持仅 `ADMIN`。 | 阶段 5 已完成。 |
| 并发重复订单申诉风险 | 待确认 | `DisputeRepository.existsByOrderIdAndStatusIn` 有业务检查，但未确认 DB 级唯一/锁保护。 | 阶段 6 只读核查并写明风险，必要时只在 `dispute/**` 内处理。 |
| PARTIAL_REFUND 缺少金额 | D 侧已完成/跨 C | `DisputeArbitrateRequest` 已补 `responsibility/refundAmount` 并校验 `PARTIAL_REFUND` 金额必填且大于 0；订单金额落库仍由 C 线处理。 | 阶段 6 已完成。 |

## 已确认可复用能力

- `Notification` 实体已有 `eventType, relatedType, relatedId, targetType, targetId, sourceType, sourceId, dedupeKey, metadataJson, isRead, createdAt`。
- `NotificationController` 已有：`GET /notifications`、`GET /notifications/unread-count`、`PATCH /notifications/{notificationId}/read`、`PATCH /notifications/read-all`。
- `NotificationService` 已限制只查询/标记当前用户通知，并限制分页 `size <= 100`。
- `ReviewController` 已有 `GET /reviews/{reviewId}`。
- `CreditService` 已有信用流水幂等和反向调整能力。

## 阶段 1 修改记录

本阶段未修改 Java、SQL、前端或配置文件。

新增文档：

- `docs/D-line-backend-fix-progress.md`
- `docs/C线需要修改项与D线接口交付说明.md`

## 阶段 2：通知后端基础能力

状态：已完成。

修改文件：

- `backend/src/main/java/com/action/camera/dispute/service/DisputeService.java`
- `backend/src/test/java/com/action/camera/dispute/service/DisputeServiceTest.java`
- `backend/src/test/java/com/action/camera/notification/service/NotificationServiceTest.java`

完成内容：

- 复用既有 `Notification` 字段，不新增重复字段。
- `DISPUTE` 通知改为稳定携带：
  - `targetType=DISPUTE`
  - `targetId=disputeId`
  - `sourceType=DISPUTE`
  - `sourceId=disputeId`
  - `metadataJson={"orderId":orderId}`
  - `dedupeKey=dispute:{eventType}:{disputeId}:{receiverId}`
- 补充通知服务测试：
  - 默认 `target/source` 回填
  - 完整跳转契约字段
  - 分页 `size` 上限
- 补充订单申诉通知测试，确认 C 线可按 `metadataJson.orderId` 跳转到订单详情申诉区域。

测试结果：

```text
mvn "-Dtest=NotificationServiceTest,DisputeServiceTest" test
BUILD SUCCESS
Tests run: 17, Failures: 0, Errors: 0, Skipped: 0
```

## 阶段 3：评价详情接口

状态：已完成。

核对结论：

- `GET /reviews/{reviewId}` 已存在，不重复新增接口。
- `ReviewResponse` 已有详情页基础字段：
  - `reviewId`
  - `orderId`
  - `reviewerId`
  - `targetUserId`
  - `direction`
  - `rating`
  - `content`
  - `isVisible`
  - `createdAt`
  - `replyContent`
  - `replyTime`
- `targetUserId` 即详情页所需 `revieweeId`。
- `replyContent/replyTime` 即第一版追评展示字段。

修改文件：

- `backend/src/main/java/com/action/camera/review/dto/ReviewResponse.java`
- `backend/src/main/java/com/action/camera/review/service/ReviewService.java`
- `backend/src/test/java/com/action/camera/review/service/ReviewServiceTest.java`

完成内容：

- `ReviewResponse` 新增 `complaintStatus`，供评价详情页判断当前评价是否已有申诉。
- `ReviewService.detail()` 修复 ADMIN 查看隐藏评价路径：先按 `UserContext.currentRole=ADMIN` 放行，不再被本地 `OrderQueryPort` 的订单双方校验误挡。
- `complaintStatus` 权限收敛：
  - 评价双方可见；
  - ADMIN 可见；
  - 无关用户查看公开评价时返回 `null`，不暴露申诉状态。
- 补充测试：
  - ADMIN 可查看隐藏评价详情；
  - 评价双方/ADMIN 可看到 `complaintStatus=PENDING`；
  - 无关用户不能看到 `complaintStatus`。

测试结果：

```text
mvn "-Dtest=ReviewServiceTest" test
BUILD SUCCESS
Tests run: 20, Failures: 0, Errors: 0, Skipped: 0
```

## 阶段 4：评价申诉证据文件校验

状态：已完成。

修改文件：

- `backend/src/main/java/com/action/camera/review/port/EvidenceFileMetadata.java`
- `backend/src/main/java/com/action/camera/review/port/EvidenceFileQueryPort.java`
- `backend/src/main/java/com/action/camera/review/adapter/LocalEvidenceFileQueryAdapter.java`
- `backend/src/main/java/com/action/camera/review/service/ReviewComplaintService.java`
- `backend/src/test/java/com/action/camera/review/service/ReviewComplaintServiceTest.java`

完成内容：

- 新增 D 线薄 Port：`EvidenceFileQueryPort`。
- 新增本地适配器 `LocalEvidenceFileQueryAdapter`，只读调用既有 `FileRepository`，未修改 `file/**`、`application/**`、`domain/**`。
- `ReviewComplaintService.create()` 对 `evidenceFileIds` 做标准化与校验：
  - 空值允许，保存为 `null`；
  - 非空值必须为英文逗号分隔的正整数；
  - 最多 5 个；
  - 不允许重复；
  - 文件必须存在；
  - 文件上传者必须是当前申诉人；
  - 仅允许 `image/*` 或 `application/pdf`；
  - 保存前标准化为 `id1,id2`。
- 文件删除状态：当前 `FileRecord` 没有 `deleted/deletedAt/status` 字段，D 线无法真实校验“未删除”，已作为跨模块问题写入 C/A 交付说明。

测试结果：

```text
mvn "-Dtest=ReviewComplaintServiceTest" test
BUILD SUCCESS
Tests run: 12, Failures: 0, Errors: 0, Skipped: 0
```

## 阶段 5：仲裁权限统一为 ADMIN

状态：已完成。

修改文件：

- `backend/src/main/java/com/action/camera/review/service/ReviewComplaintService.java`
- `backend/src/test/java/com/action/camera/review/service/ReviewComplaintServiceTest.java`

完成内容：

- 评价申诉仲裁、管理列表、评价关联申诉管理访问统一收敛为 `ADMIN`。
- 旧数据里若存在 `current_role=ARBITRATOR`，当前不可仲裁、不可访问仲裁列表。
- 未修改全局鉴权，未删除角色枚举。
- 订单申诉仲裁原本已是 `ADMIN`，本阶段未因权限收敛改订单模块。

## 阶段 6：订单申诉 D 线侧契约

状态：已完成。

修改文件：

- `backend/src/main/java/com/action/camera/dispute/dto/DisputeArbitrateRequest.java`
- `backend/src/main/java/com/action/camera/dispute/dto/DisputeResponse.java`
- `backend/src/main/java/com/action/camera/dispute/entity/Dispute.java`
- `backend/src/main/java/com/action/camera/dispute/service/DisputeService.java`
- `backend/src/test/java/com/action/camera/dispute/service/DisputeServiceTest.java`

完成内容：

- `DisputeArbitrateRequest` 从 `resolution/comment` 扩展为：
  - `resolution`
  - `responsibility`
  - `refundAmount`
  - `comment`
- 保留旧二参构造，兼容既有测试和内部调用。
- `Dispute` 新增仲裁记录字段：
  - `responsibility`
  - `refundAmount`
- `DisputeResponse` 返回：
  - `responsibility`
  - `refundAmount`
- 校验规则：
  - `FULL_REFUND/PARTIAL_REFUND` 必须提供 `responsibility`；
  - 允许责任值：`PROVIDER_FAULT/CUSTOMER_FAULT/BOTH_FAULT/NO_FAULT`；
  - `NONE` 不能用于退款裁定；
  - `PARTIAL_REFUND` 必须提供 `refundAmount > 0`；
  - `REJECTED/REWORK` 的 `responsibility/refundAmount` 不生效，响应和记录中置空；
  - `comment` 最长 1000 字。
- 未修改：
  - `order/**`
  - 订单退款金额落库
  - 订单状态机
  - 返修流转

跨模块问题：

- `PARTIAL_REFUND.refundAmount` 当前只记录在 D 线申诉裁定记录，订单侧金额落库仍需 C 线在订单裁定 Service/Port 中实现。
- `refundResponsibility` 最终应进入 C 线订单快照，D 线评价后续应从 `OrderSnapshot.refundResponsibility` 读取，不再复用 `refundStatus`。
- 并发重复订单申诉目前仍主要靠服务层 `existsByOrderIdAndStatusIn`，若要 DB 级强约束需要 C/DB 迁移确认。

## 阶段 7：测试与最终交付

状态：已完成。

定向测试：

```text
mvn "-Dtest=ReviewComplaintServiceTest,DisputeServiceTest,ReviewServiceTest,NotificationServiceTest" test
BUILD SUCCESS
Tests run: 53, Failures: 0, Errors: 0, Skipped: 0
```

全量测试：

```text
mvn test
BUILD SUCCESS
Tests run: 389, Failures: 0, Errors: 0, Skipped: 0
```

## 当前剩余跨模块问题

- C 线订单：拆分 `refundStatus/refundResponsibility`，保存 `refundAmount/refundReason/refundedAt`，实现仲裁结果对应订单迁移。
- C 线订单详情：支持 `/orders/{orderId}?tab=dispute` 或真实路由等价落点。
- C 线消息：实现 `conversationUnreadCount`，与 D 线 `/notifications/unread-count` 分离。
- C 线订单文案：清理旧档期文案。
- 文件模块：提供 `deleted/deletedAt/status` 或等价能力，完善 PRIVATE 文件下载权限。
- DB 迁移：生产库需补 `disputes.responsibility`、`disputes.refund_amount` 字段；当前测试依赖 JPA DDL 自动建列。

按指令，阶段 7 完成后不提交、不 push，等待确认。
