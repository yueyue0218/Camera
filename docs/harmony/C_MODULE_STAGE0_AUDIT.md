# HarmonyOS C 模块阶段 0 审计

## 基准和结论

- 基准：`origin/main` 的 `d36689b78922cfa3f4da9b6cf25053ace5667641`。审计分支为 `codex/feat/harmony-c-workflow-parity`，从该基准创建。
- 原工作区 `D:/Codex/Camera` 在 `codex/prelaunch-p0`，有未跟踪的 `docs/BP/`；本审计使用独立、干净的 `D:/Codex/Camera-main-review`，未覆盖原工作区。
- 本文是源码审计，不代表设备运行验收。`harmony/build-profile.json5:7` 声明 SDK 26；本机实际安装于 `D:/DevEcoStudio`，用该 SDK 和随附 Node/Hvigor 完成 56/56 项主机测试，以及默认 `assembleHap`（34 tasks，约 1 分 48 秒）。HAP 未签名，未安装到模拟器或真机。本机绝对路径只用于报告，不进入构建配置。
- Web `npm ci` 后 `npm run build` 通过（有体积与混合导入警告），`npm run lint` 为 0 error / 38 warnings；`npm ci` 提示 11 项依赖漏洞，未运行会改动锁文件的自动修复。后端 `mvn test` 为 BUILD SUCCESS，Surefire 汇总 770 项、0 failure、0 error、2 skipped；既有 Maven 插件重复声明及弃用 API 警告不在本轮处理。构建产物与依赖均被仓库忽略。
- 现有鸿蒙页：大厅、需求详情、橱窗详情、登录、发布需求、会话列表/详情、订单列表、个人中心，见 `harmony/entry/src/main/ets/pages/Index.ets:26`。动态和通知仍为占位，见 `harmony/entry/src/main/ets/features/shell/PortraAppShell.ets:27`、`harmony/entry/src/main/ets/pages/MessagePage.ets:87`。
- 核心判断：消息、报价、订单的主干已开头，但会话体验及报价后履约未闭环。首轮保持 Web 与后端状态一致，必须使用已有 `MOCK_PAY`；不得新增真实支付，也不得把待支付直接映射成已支付。

以下证据引用的行号以本次基准为准。为节省表宽，`pages/`、`api/`、`utils/` 分别指 `frontend/src/` 下同名目录；`message/`、`order/`、`delivery/`、`review/`、`photoauthorization/`、`dispute/`、`controller/`、`application/` 指 `backend/src/main/java/com/action/camera/` 下同名目录；鸿蒙段落中的 `pages/`、`model/`、`network/`、`navigation/`、`app/` 指 `harmony/entry/src/main/ets/` 下同名目录。状态标记：`部分`、`有 API 无 UI`、`缺失`、`契约待澄清`；未在设备验证的既有实现不标作“已验证”。

## Web / API / 后端 / 鸿蒙逐动作差异

| 动作与身份/前置条件 | Web 入口与 API | 后端规则、成功/失败结果 | 鸿蒙现状、所需实现 | 优先级 |
| --- | --- | --- | --- | --- |
| 会话列表，已登录 | `pages/messages/MessagesPage.jsx`；`api/conversationApi.js:4` GET `/conversations` | `message/controller/ConversationController.java:40` 只返回 ID、参与者、来源、orderId、时间；无昵称/预览/未读字段 | `pages/MessagePage.ets:31` 已请求，但显示“约拍会话/用户 #id”，通知占位。需按需补全对方资料和预览，未读须区分本地估算与服务端事实；缓存按账号隔离。部分，P1 |
| 进入/隐藏会话，参与者 | Web 列表及 `pages/messages/ConversationDetailPage.jsx:35`；DELETE `/conversations/{id}` 在 `message/controller/ConversationController.java:50` | 服务端只允许参与者隐藏；列表不会返回被隐藏会话，详情目前由列表定位 | `pages/Index.ets:52` 可进入，但无隐藏、无深链缓存；详情 `ConversationDetailPage.ets:55` 串行加载 session、列表、消息、报价，首屏易慢。部分，P1 |
| 纯文本发送，参与者 | `pages/messages/hooks/useMessageSending.js:69`；`api/conversationApi.js:26` POST `/conversations/{id}/messages` | `message/service/MessageService.java:59` 检查参与者和内容；响应 `message/dto/MessageResponse.java:15` | `ConversationDetailPage.ets:98` 可发，但等待服务器后才显示；失败保留输入但无独立失败消息及重试。需 optimistic ID、去重、重试与草稿保护。部分，P1 |
| 图片/文件消息，参与者 | `useMessageSending.js:43,106,133`；先 POST `/files/upload`，再 POST 消息，GET `/files/{id}/{variant}`/`download` | `MessageService.java:139` 检查上传者与 `MESSAGE_ATTACHMENT`；`controller/FileController.java:47,71,95` 复用私有文件鉴权 | `ConversationDetailPage.ets:242` 只渲染 `[图片]/[附件]`；`model/ApiModels.ets:117` 缺 `fileId/mimeType/size`；`network/HttpClient.ets:71` 只支持 JSON。需原生选择、multipart、Bearer 二进制读取、缩略图及失败恢复。缺失，P1/P2 |
| 报价创建，摄影师且无待确认报价 | `pages/messages/hooks/useConversationActions.js:57`；`api/quoteApi.js:4` POST `/quotations` | `message/service/QuoteService.java:29` 校验服务方身份、同会话待确认报价和时间冲突；成功为 `PENDING_CONFIRM`，冲突返回业务错误 | `ConversationDetailPage.ets:125` 有基本表单，但 `CreateQuotePayload` 仅传 7 字段，缺 Web 的选片数、使用范围、条款等；无待确认报价前置 UI，可能被后端拒绝。部分，P1 |
| 编辑待确认报价，摄影师 | `useConversationActions.js:83`；PUT `/quotations/{id}` | `QuoteService.java:53` 仅待确认且服务方可编辑；成功仍待确认 | 鸿蒙无 PUT 客户端、编辑入口和草稿。缺失，P2 |
| 客户拒绝报价 / 摄影师重发 | `useConversationActions.js:109,157`；POST `/quotations/{id}/reject`，重发走 POST `/quotations` | `QuoteService.java:115` 客户拒绝使状态为 `REJECTED`；旧报价不再是待确认 | 鸿蒙仅有确认按钮 `ConversationDetailPage.ets:214`；需拒绝理由、旧报价带入新表单，不能把拒绝当作会话结束。缺失，P1 |
| 客户确认报价并生成订单 | `useConversationActions.js:129`；POST `/quotations/{id}/confirm` | `QuoteService.java:90` 客户可确认；`order/service/OrderService.java:90` 幂等返回唯一订单，初态 `PENDING_PAYMENT`；非待确认/过期失败 | `ConversationDetailPage.ets:159` 已调接口但只刷新报价，丢弃响应里的 `orderId`；无订单事件与“下一步确认支付”。部分，P1 |
| 模拟支付，订单客户且 `PENDING_PAYMENT` | `useConversationActions.js:189`、`pages/orders/hooks/useOrderActions.js:55`；`api/orderApi.js:25` POST `/orders/{id}/payments` | `order/controller/OrderController.java:57` 仅 `MOCK_PAY`；`order/service/OrderService.java:110` 校验客户与分金额，已有记录走幂等分支，成功到 `PAID_PENDING_SHOOT`。`PaymentResponse.java:15` 回传 orderStatus/payMethod | 鸿蒙完全无支付调用；`OrderPage.ets:57` 将 `PENDING_PAYMENT` 显示为“约定已确认”，会遮蔽待操作。需明确“模拟支付，不发生真实扣款”及防连点，成功后读详情。缺失/错误展示，P1 |
| 订单列表、详情、日志，参与者 | `pages/orders/hooks/useOrdersData.js:117,146`；GET `/orders`、`/orders/{id}`、`/status-logs` | `order/controller/OrderController.java:39,51,104`；详情 DTO 带 conversationId、双方 ID、金额、拍摄/交付时间、托管/退款状态，见 `order/dto/OrderResponse.java:16` | `OrderPage.ets:30` 只取列表、展开卡片，未取详情/日志；`OrderSummary` 缺关键字段，见 `model/ApiModels.ets:205`。需详情页/时间线与独立加载/错误态。部分，P1 |
| 取消 / 模拟退款，订单客户 | `pages/orders/hooks/useOrderActions.js:122`；POST `/orders/{id}/cancel` | `OrderService.java:174`：待支付取消到 `CANCELLED`；模拟支付后且拍摄开始前取消到 `REFUNDED`；其他状态拒绝 | 鸿蒙无入口/请求。要按订单关系和服务端时间显示按钮，失败后保留原状态并刷新。缺失，P2 |
| 拍摄开始/结束 | Web 订单时间线 `pages/orders/components/OrderTimelineCard.jsx:4` | `order/scheduler/OrderAutoConfirmScheduler.java:18` 与 `OrderService.java:629` 自动推进，非客户端手动操作 | 鸿蒙显示简单状态，无时间线和前台恢复刷新；不可新增“开始拍摄”按钮。部分，P2 |
| 作品上传/多轮返修交付，订单摄影师 | `pages/orders/hooks/useOrderActions.js:80`；`api/deliveryApi.js:4` multipart POST `/orders/{id}/deliveries` | `delivery/service/DeliveryService.java:124` 仅订单服务方且 `PENDING_DELIVERY/REWORK_REQUIRED`；最多 20 文件；成功建立交付记录并推进状态 | 鸿蒙无 multipart、选图、进度、上传失败恢复和交付记录 DTO。缺失，P2 |
| 作品查看/下载，订单双方 | `pages/orders/OrdersPage.jsx:312,348`、`api/deliveryApi.js:4` GET `/orders/{id}/deliveries`，文件 GET | `delivery/service/DeliveryService.java:240` 只允许双方；文件还由 `application/FileService.java:162` 鉴权 | 鸿蒙无作品相册/受保护预览/下载；不能把私有文件 URL 塞给无认证 Image 组件。缺失，P2 |
| 客户返修，已交付待确认 | `pages/orders/hooks/useOrderActions.js:98`；POST `/orders/{id}/request-rework` | `OrderService.java:217` 仅客户、仅 `DELIVERED_PENDING_CONFIRM`；成功到 `REWORK_REQUIRED` | 鸿蒙无表单和请求；应在会话任务/作品页打开，保留文字草稿。缺失，P2 |
| 客户确认收片 / 自动确认 | `useConversationActions.js:209`；POST `/orders/{id}/status-transitions` target `COMPLETED` | `order/controller/OrderController.java:70,118` 限客户操作；`OrderService.java:353` 交付 7 天后自动确认 | 鸿蒙无入口和刷新；确认需二次确认、展示交付批次，后台完成后同步。缺失，P2 |
| 展示授权申请，订单摄影师且完成、有交付图片 | `pages/orders/hooks/useOrderActions.js:141`；POST `/orders/{id}/photo-authorizations/requests` | `photoauthorization/service/PhotoAuthorizationService.java:176,183,198,226` 要求已完成、图片来自该订单交付，`fileIds` 非空 | 鸿蒙无授权选图/申请记录；消息附件 ID 不可当交付图片 ID。缺失，P3 |
| 客户同意/拒绝展示授权，待决定 | `useOrderActions.js:167`；POST `/photo-authorizations/{id}/approve|reject` | `PhotoAuthorizationService.java:172,190` 仅客户且 `PENDING`；变 `GRANTED/REJECTED` | 鸿蒙无请求卡、详情和拒绝备注；应以交付图片缩略图确认授权对象。缺失，P3 |
| 评价/追评，订单双方 | `pages/orders/hooks/useOrderActions.js:184,247`；POST `/orders/{id}/reviews`、`/reviews/{id}/follow-up` | `review/service/ReviewService.java:202`：`COMPLETED` 可双向评价；`REFUNDED` 仅按责任裁定；原评价人才能追评 | 鸿蒙无评价、详情、追评。缺失，P3 |
| 评价投诉，**被评价人** | `useOrderActions.js:216`；POST `/reviews/{id}/complaints`，列表/详情在 `api/reviewApi.js:27` | `review/service/ReviewComplaintService.java:79,183`：仅被评价人可投诉，待处理可撤销；最多 5 个证据文件 | 鸿蒙无 UI。Web 在接口不可用时会落本地申诉，见 `useOrderActions.js:229`；鸿蒙不得把本地记录冒充已提交。缺失，P3 |
| 订单争议，订单双方 | Web `pages/messages/utils/workbenchState.js:218` 明确 `canAppeal: false`；无 dispute API 客户端 | 后端 `dispute/controller/DisputeController.java:28,35,49,55` 有发起、回复、详情；`DisputeService.java:69,72` 拒绝已完结订单，进入 `APPEALING` | 两端前台都未闭环。这不是评价投诉；是否纳入鸿蒙首版需产品/后端确认，不能仅以“Web 有申诉”推定。契约待澄清，P3 |

公共失败行为：网络错误不清空已有数据；401/40101 走现有会话过期处理；403 显示无权限；409/业务状态冲突刷新权威数据并保留可编辑草稿。证据：`harmony/entry/src/main/ets/network/HttpClient.ets:85`、`harmony/entry/src/main/ets/network/ErrorMapper.ets:27,43,85`、`backend/src/main/java/com/action/camera/order/controller/OrderController.java:118`。所有写操作须防连点，不能仅凭页面按钮可见性替代后端授权。

逐动作验收向量（每行均须跑正向、反向和失败恢复；响应 DTO 以“关键 DTO 与接口边界”及上表控制器为准）：

| 动作组 | 必须验证的前置/状态/失败场景 | 成功后权威数据 |
| --- | --- | --- |
| 列表与文本消息 | 双账号各看同一会话；无权用户 403；空列表、慢网、断网、轮询与发送并发、快速切会话；发送失败保留原文且重试不重复 | GET `/conversations/{id}/messages` 与 POST 返回同一条服务端 messageId；列表预览同步 |
| 图片/文件消息 | 非图片不能伪装图片；无权访问私有文件；上传中离页、上传成功但发消息失败、失败重试；缩略图和下载分别校验鉴权 | `MessageResponse.fileId/messageType` 与私有文件授权一致，临时预览可释放 |
| 报价 | 摄影师创建/编辑、客户确认/拒绝；过期、已有待确认报价、时间冲突、重复点击；拒绝后重发并继续聊天 | `QuoteResponse.status` 更新；确认响应唯一 orderId、订单初态 `PENDING_PAYMENT` |
| 模拟支付/取消 | 非客户、金额不匹配、重复确认、同时两端操作、拍摄开始边界；断网后查询而不是盲目重试 | `PaymentResponse.orderStatus=PAID_PENDING_SHOOT` 且一笔支付记录；取消为 `CANCELLED/REFUNDED` |
| 订单时间与交付 | 后台自动拍摄开始/结束、交付超时、多个批次；摄影师/客户/第三方分别上传；超大/非支持文件；上传后刷新 | `OrderResponse.status`、status logs、delivery rounds 一致；文件只被订单双方读到 |
| 返修/收片 | 非客户、未交付、重复返修、多轮交付、自动确认与人工确认竞争；失败后草稿与既有作品不丢 | `REWORK_REQUIRED -> DELIVERED_PENDING_CONFIRM -> COMPLETED`；日志与作品批次一致 |
| 展示授权 | 未完成订单、无图片、其他订单或消息附件 fileId、重复/非待处理审批、非客户审批 | 申请仅含真实交付图片；授权 `PENDING -> GRANTED/REJECTED` |
| 评价/追评/评价投诉 | 已完结双向评价、责任退款、非原评价人追评、非被评价人投诉、重复提交、证据文件拒绝、撤销限制 | 服务端 review/complaint ID 可再次查询；本地草稿不当作成功记录 |
| 订单争议（待确定范围） | 进行中与已完结订单、双方与第三方、重复争议、另一方回复、裁定后恢复 | `DisputeResponse.status` 与 `OrderResponse.status=APPEALING/裁定状态` 一致 |

## 关键 DTO 与接口边界

| 契约 | 请求/响应与边界 | 鸿蒙缺口 |
| --- | --- | --- |
| 身份 | `/auth/native/sms/verify`、`/auth/native/refresh`、`/auth/session`，Bearer 见 `controller/AuthController.java:70,86,104`；`app/AppClient.ets` 已有恢复/过期处理 | C 页面必须使用订单 `customerId/providerUserId`、报价 `customerId/providerUserId` 判操作身份；不能只看 UI 当前角色。后端交付还检查 `UserContext.getCurrentRole()`，见 `delivery/service/DeliveryService.java:126`，双角色账号切换需要实测。 |
| 报价 | `CreateQuoteRequest.java:11` 有金额、时间、地点、张数、照片使用范围、条款等；`QuoteResponse.java:14` 有状态/过期时间；确认响应有 orderId，见 `ConfirmQuoteResponse.java:13` | `ApiModels.ets:136` 的创建模型、报价模型字段不全；可先最小可用，但不能静默忽略 Web 已要求的重要约定字段。 |
| 订单/模拟支付 | `MockPaymentRequest` 必须为 `payMethod=MOCK_PAY` + `amountCent`；`PaymentResponse.java:15` 返回新状态；PaymentRecord/EscrowStatus 仍是模拟账务记录 | 不重写状态机，不直调状态迁移跳过模拟支付。Web 的“资金已进入平台担保”等文案见 `useConversationActions.js:191`，鸿蒙须明确为模拟，不复制真实资金措辞。 |
| 文件 | 消息文件：`/files/upload` multipart，bizType `MESSAGE_ATTACHMENT`、visibility `PRIVATE`，再用 fileId 发送消息；交付文件：直接 `/orders/{id}/deliveries` multipart；图片变体/下载：GET `/files/{id}/{variant|download}`，见 `controller/FileController.java:47,71,95` | 两类上传不可共用同一业务方法；仅复用安全二进制传输/取消/认证机制。不能在 URL 中放 Token。 |
| 授权 | `PhotoAuthorizationRequest.java:9` 用真实交付图片 `fileIds`；`PhotoAuthorizationResponse.java:17` 返文件元数据 | UI 选图必须来自交付批次，审批需展示具体图片，不接受任意本地 fileId。 |

## 订单角色和状态矩阵

服务端状态机与权限是最终权威，下面仅是客户端可见动作模型。证据：`backend/src/main/java/com/action/camera/order/statemachine/OrderStatusMachine.java:37`、`order/service/OrderService.java:109,173,216,353`、`frontend/src/utils/orderActionVisibility.js:5`。

| 状态 | 客户可见动作 | 摄影师可见动作 | 状态来源/限制 |
| --- | --- | --- | --- |
| `PENDING_PAYMENT` | 确认模拟支付、取消 | 等待客户 | 支付成功 `PAID_PENDING_SHOOT`，取消 `CANCELLED` |
| `PAID_PENDING_SHOOT` | 拍摄前取消并模拟退款 | 查看约定 | 到开始时间后系统推进 `SHOOTING`，禁止手动跳转 |
| `SHOOTING` | 查看拍摄信息 | 查看拍摄信息 | 到结束时间后系统推进 `PENDING_DELIVERY` |
| `PENDING_DELIVERY` | 等待作品 | 上传作品 | 上传成功 `DELIVERED_PENDING_CONFIRM`；超期可能自动退款 |
| `DELIVERED_PENDING_CONFIRM` | 查看/下载、返修、确认收片 | 查看交付 | 返修到 `REWORK_REQUIRED`，确认或 7 天超时到 `COMPLETED` |
| `REWORK_REQUIRED` | 查看返修原因/等待 | 重新上传作品 | 多轮交付后回 `DELIVERED_PENDING_CONFIRM` |
| `COMPLETED` | 查看作品、授权审批、评价 | 授权申请、评价 | 不再展示支付/返修；退款等状态按服务端结果 |
| `CANCELLED` | 查看档案 | 查看档案 | 无普通履约操作 |
| `REFUNDED` | 查看档案；有责任裁定时才可能评价 | 同左 | 不能笼统显示“可评价” |
| `APPEALING` | 查看争议进度/按规则回复 | 同左 | 普通订单操作停用；管理员裁定恢复或终结，前台范围待确认 |

报价状态：`PENDING_CONFIRM` 可由摄影师编辑、客户确认/拒绝；`REJECTED` 保留会话，摄影师可新建报价；`CONFIRMED` 关联订单；`EXPIRED/CANCELLED` 不再可确认，见 `message/enums/QuoteStatus.java:6`、`message/service/QuoteService.java:29,53,90,115`。授权是 `PENDING/GRANTED/REJECTED`，见 `photoauthorization/entity/PhotoAuthorization.java:23`；评价投诉和订单争议是独立状态，不得借订单 status 猜测其处理结果。

## 导航图与跨模块衔接

```text
大厅需求/橱窗 -> 详情 -> 接受响应/发起沟通 -> 会话列表/会话详情
会话详情 -> 报价详情 -> 订单详情(orderId, conversationId, returnTarget)
订单列表 -> 订单详情 -> 作品相册/上传、授权、评价、对应会话
通知 -> 对应会话/订单/授权/评价详情（需通知契约与路由）
```

现有 `pages/Index.ets:29-75` 只装配 9 个路由；`model/NavigationModels.ets:1` 无订单 ID、交付 ID 等 typed 参数；`navigation/NavigationPolicy.ets:25` 的登录跳转仅保留 conversationId。需求/橱窗详情到会话已接，见 `pages/Index.ets:125,143`；报价确认后 `pages/ConversationDetailPage.ets:167` 没有使用 orderId；订单页 `pages/OrderPage.ets:11` 没有会话回跳。最小修改仅给大厅/详情已有入口补参数与返回目标，不重写 A/B 模块。每条路由必须可从冷启动、未登录、退出、角色不匹配、重复点击和返回手势测试。

## 架构及移动交互方案

保留 `app/AppClient.ets` 的单一会话/网络边界、`network/HttpClient.ets:12` 的过期与旧响应防护、`NavigationPolicy.ets` 的可测试纯导航逻辑。不要复制 Web 的 MUI 布局或本地 fallback 业务规则。要最小拆分的是 `pages/ConversationDetailPage.ets:10`：目前一页同时做串行加载、5 秒轮询、发送、报价校验和两套列表绘制；`pages/OrderPage.ets:30` 也把原始 DTO 状态直接映射到 UI。Web 的 `pages/messages/hooks/useConversationData.js:45`、`useMessageSending.js:14`、`utils/workbenchState.js:170`、`pages/orders/hooks/useOrdersData.js:45` 可作为职责参考，不要逐文件翻译。

建议只建立能消除当前复杂性的功能内职责：

- `features/conversation/`：列表协调器、详情状态/请求协调器、消息时间流适配器、轻量消息行与业务事件卡、发送草稿；事件按发生时间合流，不能把所有报价塞在消息尾部。各事件的 key 必须稳定，增量刷新不清空旧内容。
- `features/order/`：订单详情状态/刷新协调器、仅供展示的状态/角色操作模型、时间线、当前任务、作品/授权/评价入口。禁止客户端自行推进订单状态。
- `network/`：在现有 JSON Client 旁增加小型 multipart 上传与受保护二进制读取边界，复用认证、错误映射和取消语义；不做万能文件组件。
- `navigation/`：补 typed `orderId/deliveryId/returnTarget`，入口集中校验并保留登录前目标。页面仅发起导航意图，不拼路由字符串。

手机 UI 规则：会话列表一行显示头像、昵称、内容预览、时间和未读状态；会话详情固定顶栏、时间顺序滚动流和安全区内的输入栏，消息方向、头像、宽度与时间统一；图片本体展示、文件轻量卡、报价/订单/交付/授权使用同一事件外层但内容不同。报价在流里只露摘要，详情与确认/拒绝用底部弹层；订单页先列表，再单列详情、时间线、当前任务和后续入口；交付相册可横滑/放大/下载，授权选图明确批次。窄屏、长中文、键盘、字体放大、触摸尺寸与返回手势都要在 Preview 和设备分别验证。性能以首屏、发送响应、图片缩略图耗时实测，不凭感觉改轮询；离页/后台停轮询，回前台增量同步，旧响应不能覆盖新会话。

## 施工阶段与独立提交

| 阶段 | 目标/允许修改 | 接口、依赖与风险 | 测试和完成标准 | 建议 commit |
| --- | --- | --- | --- | --- |
| 0 审计 | 仅本文档；不改业务代码 | 最新 main、SDK/设备、Web/后端证据 | 三端矩阵、状态/导航/架构/风险与验证边界齐全 | `docs(harmony): audit C workflow parity` |
| 1 会话基础 | `harmony/.../pages/MessagePage.ets`、`ConversationDetailPage.ets`、必要的 `features/conversation/`、`network/ApiService.ets`、`model/ApiModels.ets`、`navigation/` 和对应测试；跨模块仅最小入口修补 | GET `/conversations`、GET/POST messages、GET quotes；昵称/预览需补全，未读来源需标注；认证沿用 AppClient | 两账号在一条会话互发文本，刷新/离页/断网/失败重试/草稿/返回均稳定；构建+自动测试+设备验证分列 | `feat(harmony): stabilize conversation list and text flow` |
| 2 报价与订单建立 | 会话功能文件、订单入口、API/DTO、测试；不动状态机 | 报价 CRUD/拒绝/确认、GET order、`MOCK_PAY`；身份/金额/幂等、模拟文案 | 客户拒绝后可重报，确认只生成一单，模拟支付仅客户一次生效，订单可从会话打开 | `feat(harmony): complete quote and mock payment flow` |
| 3 履约 | `features/order/`、交付页面/组件、文件网络层和测试 | GET detail/log/deliveries，POST cancel/rework/transition/delivery；multipart、私有文件、定时推进 | 双角色完整走取消/上传/多轮返修/收片，时间线与服务端一致 | `feat(harmony): add order fulfillment and delivery` |
| 4 后续服务 | 授权、评价、投诉功能文件/DTO/测试 | photo-authorization、review、review-complaint；订单争议另待产品确认；图片必须真实交付 | 授权选图/审批、双向评价、追评、被评价人投诉的成功及拒绝态均验收 | `feat(harmony): add authorization and review followups` |
| 5 体验优化 | C 模块 UI、附件/二进制/草稿/性能测试 | 图片与文件消息、缩略图、取消下载、前后台；不新建 WebSocket | 慢网/大量消息/字体缩放/键盘/长文/本地预览实测，优化前后留数据 | `feat(harmony): complete media messages and mobile polish` |
| 6 回归 | 测试和修复局限于 C 模块；若有跨模块问题单列最小补丁 | 两独立账号、服务端真实数据、签名设备、Web/后端回归 | 自动测试、模拟器、真机、未验证四类分别报告；HAP 成功不等于验收 | 按具体回归问题拆 `fix(harmony): ...` |

阶段 1 的第一条小闭环：先让已登录客户和摄影师能从现有会话列表进入同一会话，看到原有消息，在本地立即显示新文本，服务器确认后替换临时项，断网失败保留并可重试，离页/回前台保留草稿和旧消息。实施顺序：补消息 DTO/列表展示模型与测试 -> 分离详情加载/发送状态 -> 合并统一时间流的文本项 -> 接入已有导航/认证 -> 自动测试与 HAP -> 两账号设备验证。此阶段只做文本，不提前做报价/订单或附件。

本轮先交付阶段 0，不提前铺开阶段 1 页面。主机自动测试与默认 HAP 构建已可重复执行，但没有模拟器/真机验收证据；后续首条小闭环应按上文顺序实施，并把自动测试、构建、设备验证明确分开。未经允许不推 main。

## 风险与待团队确认

1. **支付文案与既有服务端文本**：服务端 `OrderService.java:137` 和 Web `useConversationActions.js:191,213` 有“资金托管/结算”措辞。鸿蒙需明确模拟、无真实扣款；涉及对外条款与通知时要与团队统一，不应悄悄改后端业务规则。
2. **订单争议不等于评价投诉**：后端 dispute API 已有，但 Web 前台 `canAppeal=false`，需确认是否纳入首版。不可让 UI 写本地成功记录冒充服务端申诉。
3. **双角色会话/交付**：订单操作按 `customerId/providerUserId` 判断；交付还要求服务方会话角色，见 `DeliveryService.java:126`。需要双身份测试账号确认切换契约，不能仅切换鸿蒙展示标签。
4. **列表数据与实时性**：后端会话列表 DTO 不含昵称、预览、未读；短期使用受控补全，但必须限制请求并发，不能每 5 秒把全部会话消息重新拉一遍。消息列表接口无分页，长历史性能需测量后与后端讨论。
5. **私有媒体与上传**：现有 Native HttpClient 仅 JSON；有图片/交付时必须用受保护二进制与 multipart，不能公开私有 URL 或在 URL 拼 Token。
6. **测试边界**：本轮已跑鸿蒙主机测试 56/56、默认 HAP 构建、Web build/lint、后端 `mvn test`（770 项，其中 2 skipped）；未运行模拟器或真机。已有主机测试主要覆盖工程底座，不能证明 C 业务闭环。阶段 1 需增加 C 模块专项测试，并记录首屏、发送和图片体验的实测耗时。
