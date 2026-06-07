# Camera 平台 API 规范文档

1. 通用说明
1.1 基础信息
项目
说明
Base URL
https://api.camera-platform.com/v1
协议
HTTPS
风格
RESTful API
数据格式
application/json; charset=utf-8
时间格式
ISO-8601，例如 2026-05-20T14:00:00+08:00
金额格式
十进制字符串或 Decimal，单位为人民币元
1.1.1 全局术语与实现约定
为统一 API、领域模型和数据库设计中的命名口径，本节作为接口实现、数据库映射和前后端联调的统一解释。
1. API 路由 /services 对应领域模型 ServicePackage，对应数据库表 service_packages。对外字段 serviceId 对应 service_packages.id。
2. API 路由 /quotations 对应领域模型 Quote，对应数据库表 quotes。对外仍使用 quotationId，避免接口语义突然变化。
3. API 路由 /appeals 对应领域模型 Dispute，对应数据库表 disputes。对外保留 appeal 作为用户可理解的“申诉”命名，内部实现可映射为 Dispute。
4. providerId 在 API 对外响应中表示服务方用户 ID，即 providerUserId。providerProfileId 仅用于服务方主页、作品集、服务橱窗内部关联，不在普通响应中强制暴露。
5. 服务橱窗咨询采用会话直连方案：消费者从服务橱窗发起咨询时，系统直接创建 Conversation，并把首条咨询内容保存为 Message，不单独定义咨询资源。
6. Conversation.sourceType 统一使用：DEMAND_RESPONSE、SERVICE_PACKAGE、PORTFOLIO、DIRECT。服务橱窗咨询创建的会话使用 sourceType = SERVICE_PACKAGE，sourceId = serviceId。
7. 关键状态枚举以本 API 文档为对外接口契约；后端实现、数据库字典和前端状态展示应保持同一套枚举口径。

1.2 统一成功响应
所有接口实际返回值都必须使用统一响应包装。后续接口章节中标注为“响应 data”的 JSON 示例，均表示统一响应
体中的 data 字段内容；完整响应格式如下：
{
 "code": 200,
 "message": "success",
 "data": {}
}
1.3 统一失败响应
{
 "code": 40902,
 "message": "当前订单状态不允许该操作",
 "data": {
 "field": "status",
 "currentStatus": "COMPLETED",
 "allowedStatuses": ["PAID_PENDING_SHOOT", "SHOOTING"]
 }
}

1.4 全局错误码
错误码
标识
HTTP 状态
说明
200
OK
200
请求成功
40001
VALIDATION_ERROR
400
参数格式错误、缺少必填字段、字
段范围不合法
40002
SMS_CODE_INVALID
400
短信验证码错误或已过期
40003
IDEMPOTENCY_KEY_REQUIRED
400
支付、确认报价等关键写接口缺少
幂等键
40102
CALLBACK_SIGNATURE_INVALID
401
支付回调签名校验失败
40101
UNAUTHORIZED
401
未登录或 token 失效
40301
FORBIDDEN
403
当前用户无权限访问该资源或执行
该操作
40401
RESOURCE_NOT_FOUND
404
资源不存在
40901
SCHEDULE_CONFLICT
409
服务方档期冲突或已被占用
40902
ORDER_STATUS_INVALID
409
当前订单状态不允许该操作
40903
QUOTATION_EXPIRED
409
报价单已过期
40904
ALREADY_RESPONDED
409
已经响应过该需求，或同一用户与同一服务橱窗已存在有效会话
40905
DUPLICATE_REVIEW
409
当前订单已评价，不能重复评价
40906
PAYMENT_AMOUNT_MISMATCH
409
支付金额与订单金额不一致
40907
SETTLEMENT_STATUS_INVALID
409
当前结算状态不允许该操作
40908
CONTRACT_NOT_CONFIRMED
409
合同条款、安全提示或照片授权未
确认
42201
APPEAL_NOT_ALLOWED
422
当前订单不可申诉
42202
DELIVERY_NOT_COMPLETE
422
交付作品不完整，不能确认收货
42203
REAL_CUSTOMER_WORK_UNVERI
FIED
422
真实客片缺少订单或照片授权依据
50001
INTERNAL_ERROR
500
系统内部错误
50301
THIRD_PARTY_SERVICE_UNAVAIL
ABLE
503
第三方服务不可用，例如短信、对
象存储、支付服务
1.5 鉴权与角色规则
除发送验证码、登录注册、公开浏览服务方主页、公开浏览作品集、公开浏览服务大厅、公开浏览评价外，其余接口
均需要携带：
Authorization: Bearer <token>
角色
允许操作
CUSTOMER
发布需求、咨询服务、确认或拒绝报价、支付订单、确认收货、发起申诉、
评价服务方
PROVIDER
发布服务橱窗、响应需求、发送报价、维护档期和作品集、上传交付作品、
回复申诉、回复评价
ADMIN
审核服务方认证、处理举报与仲裁、查看运营大盘
订单、会话、交付作品、申诉详情只允许订单相关双方和管理员查看。服务方不能查看其他服务方的私有档期备注、
订单明细或交付文件。订单详情默认不返回完整手机号，若业务需要展示联系方式，只返回脱敏号码。
1.6 分页规范
分页查询统一使用：

参数
类型
必填
说明
page
Integer
是
页码，从 1 开始
size
Integer
是
每页条数，建议 10 到 50
分页响应统一为：
{
 "total": 128,
 "page": 1,
 "size": 10,
 "pages": 13,
 "list": []
}
1.7 幂等规则
以下接口必须携带 Idempotency-Key 请求头，避免重复点击、网络重试导致重复创建资源：
接口
幂等目的
POST /quotations/{quotationId}/confirm
避免重复确认报价并重复生成订单
POST /orders/{orderId}/payments
避免重复创建支付单
POST /orders/{orderId}/confirmations
避免重复确认收货
POST /reviews
避免重复评价
POST /orders/{orderId}/appeals
避免重复发起申诉
1.8 参数说明规范
每个接口的参数分为路径参数、查询参数、请求头参数和请求体参数。接口正文中直接列出路径参数与查询参数；复
杂请求体字段的类型、必填、说明与校验规则统一见“12. 主要请求参数索引”。后端实现时必须按参数索引进行校验
，校验失败统一返回 40001 VALIDATION_ERROR。
1.9 ID 命名规则
Camera平台的账号主体统一使用 userId。服务方不是独立账号类型，而是用户账号上的 PROVIDER 角色。
名称
含义
使用规则
userId
平台用户 ID
需求方、服务方、管理员的统一用户标识
providerId
服务方主页 ID
当前版本中等同于具备 PROVIDER 角色的
userId，用于 /providers/{providerId} 路由的
业务可读性
customerId
需求方用户 ID
等同于具备 CUSTOMER 角色的 userId
orderId
订单 ID
使用字符串，例如 ORD889900
fileId
文件 ID
文件上传后返回，用于业务对象引用
响应中涉及服务方对象时优先返回 providerId；涉及通用用户对象时返回 userId。
2. 核心订单流程与状态机
2.1 业务主链
1. CUSTOMER 发布需求，或 PROVIDER 发布服务橱窗。
2. 双方互选成功后，系统创建一对一会话 conversation。
3. PROVIDER 在会话中发送正式报价单 quotation。
4. CUSTOMER 确认报价，系统检查档期冲突并生成 PENDING_PAYMENT 订单。

5. CUSTOMER 支付订单，系统将订单置为 PAID_PENDING_SHOOT，并通过档期模块锁定服务方时段。
6. 到达拍摄阶段后，订单进入 SHOOTING 或 PENDING_DELIVERY。
7. PROVIDER 上传原片与精修片，订单进入 DELIVERED_PENDING_CONFIRM。
8. CUSTOMER 确认收货，订单进入 COMPLETED，系统开放双方评价入口。
9. 若交付质量、爽约、恶意评价或照片违规使用存在争议，订单双方可按申诉类型发起申诉，订单进入
APPEALING，由 ADMIN 仲裁。
2.2 订单状态枚举
状态
含义
进入方式
可转移到
PENDING_PAYMENT
待支付
确认报价后生成订单
PAID_PENDING_SHOOT,
CANCELLED
PAID_PENDING_SHOOT
已支付，待拍摄
支付成功
SHOOTING, CANCELLED,
APPEALING
SHOOTING
拍摄中
服务方或系统标记开始拍摄
PENDING_DELIVERY,
APPEALING
PENDING_DELIVERY
待交付
拍摄完成后等待服务方上传作品
DELIVERED_PENDING_CONFIRM,
 APPEALING
DELIVERED_PENDING_CONFIRM
已交付，待确认
服务方上传交付作品
COMPLETED, APPEALING,
REWORK_REQUIRED
COMPLETED
已完成
需求方确认收货或仲裁完成
无
CANCELLED
已取消
支付前取消、支付后按规则取消
无
APPEALING
仲裁中
需求方发起申诉
COMPLETED, REWORK_REQUIR
ED, REFUNDED
REWORK_REQUIRED
待返修
管理员判定返修
PENDING_DELIVERY,
APPEALING
REFUNDED
已退款
管理员判定退款或取消退款完成
无
状态变更必须通过订单领域方法完成，不能由 Controller 直接修改 status 字段。
2.3 报价单状态枚举
状态
含义
PENDING_CONFIRM
待需求方确认
CONFIRMED
已确认，并已生成订单
REJECTED
已拒绝
EXPIRED
已过期
CANCELLED
服务方撤回
同一会话允许多次沟通后重新报价，但同一时刻只能存在一个 PENDING_CONFIRM 的有效报价。
2.4 担保交易状态枚举
订单金额由平台托管，需求方确认收货或到达自动确认时间后进入结算流程。MVP 阶段可以使用模拟支付和模拟结
算，但状态字段必须保留。
状态字段
可选值
说明
escrowStatus
NOT_PAID / HELD / RELEASED / REFUNDED
资金托管状态
settlementStatus
NOT_SETTLED / SETTLING / SETTLED /
SETTLEMENT_FAILED
服务方结算状态
refundStatus
NONE / PENDING_REFUND / REFUNDED /
REFUND_FAILED
退款状态

规则：
1. 支付成功后 escrowStatus = HELD，资金处于平台托管状态。
2. 需求方确认收货后，系统触发结算，settlementStatus 从 NOT_SETTLED 进入 SETTLING。
3. 交付后 7 天需求方未确认也未申诉，系统自动确认收货，并记录 autoConfirmTime。
4. 订单取消或仲裁退款时，按取消规则和仲裁结果更新 refundStatus 与 escrowStatus。
3. 身份认证与用户基础接口
3.1 发送短信验证码
POST /auth/sms
权限：Public
{
 "mobile": "13800000000",
 "type": "LOGIN"
}
响应 data：null
可能错误：40001, 40002, 50301
3.2 登录与注册
POST /sessions
权限：Public
{
 "loginType": "MOBILE",
 "mobile": "13800000000",
 "verifyCode": "123456",
 "role": "CUSTOMER"
}
响应 data：
{
 "token": "eyJhbGciOiJIUzI1Ni...",
 "refreshToken": "refresh_token",
 "expiresIn": 7200,
 "user": {
 "userId": 10086,
 "role": "CUSTOMER",
 "isNewUser": true
 }
}
可能错误：40001, 40002, 50001
3.3 退出登录
POST /sessions/logout
权限：User
响应 data：null

3.4 获取当前用户资料
GET /users/me
权限：User
响应 data：
{
 "userId": 10086,
 "nickname": "张同学",
 "avatarUrl": "https://cdn.example.com/avatar.jpg",
 "mobileMasked": "138****1234",
 "roles": ["CUSTOMER", "PROVIDER"],
 "currentRole": "CUSTOMER",
 "city": "南京",
 "school": "南京大学",
 "studentVerificationStatus": "APPROVED",
 "providerVerificationStatus": "APPROVED"
}
可能错误：40101
3.5 更新当前用户资料
PUT /users/me
权限：User
{
 "nickname": "张同学",
 "avatarFileId": "file_avatar_001",
 "city": "南京",
 "school": "南京大学"
}
响应 data：
{
 "userId": 10086,
 "nickname": "张同学",
 "avatarUrl": "https://cdn.example.com/avatar.jpg",
 "city": "南京",
 "school": "南京大学"
}
可能错误：40001, 40101
3.6 切换当前角色
POST /users/me/role-switch
权限：User
{
 "targetRole": "PROVIDER"
}
响应 data：
{
 "currentRole": "PROVIDER"
}
业务规则：同一账号可在需求方和服务方视角之间切换；切换到 PROVIDER 前必须已通过服务方认证，或处于平台
允许的试用状态。未认证用户可先调用 POST /verification/provider 提交申请。
可能错误：40301

3.7 服务方实名认证申请
POST /verification/provider
权限：User。该接口用于申请成为服务方，审核通过后授予或激活 PROVIDER 角色，避免“未认证不能申请认证”的
权限死锁。
{
 "realName": "王小白",
 "idCardNo": "320100********1234",
 "idCardFrontFileId": "file_front_001",
 "idCardBackFileId": "file_back_001"
}
响应 data：
{
 "verificationId": 801,
 "status": "PENDING_REVIEW"
}
安全规则：身份证号和证件图片仅用于审核，不在普通接口响应中返回完整值；后端日志不得打印完整身份证号；证
件图片应使用私有对象存储，不作为公开 URL 暴露。
可能错误：40001, 40101, 40301
3.8 学生认证申请
POST /verification/student
权限：Customer
{
 "realName": "张三",
 "school": "南京大学",
 "studentNo": "241880256",
 "studentCardFileId": "file_student_card_001"
}
响应 data：
{
 "verificationId": 901,
 "status": "PENDING_REVIEW"
}
可能错误：40001, 40101
4. 文件上传与访问
本系统大量使用 fileId 引用文件。文件权限分为公开与私有：作品集展示图、头像、服务橱窗封面可设为 PUBLIC；
身份证照片、学生证、订单交付作品、申诉证据必须设为 PRIVATE，只能由授权用户访问。
4.1 上传文件
POST /files
权限：User
Content-Type：multipart/form-data
字段
类型
必填
说明
file
File
是
图片或其他业务文件
bizType
String
是
AVATAR / PORTFOLIO /
ID_CARD / STUDENT_CARD /
DELIVERY / APPEAL_EVIDENCE
visibility
String
是
PUBLIC / PRIVATE

响应 data：
{
 "fileId": "file_001",
 "url": "https://cdn.example.com/public/file_001.jpg",
 "fileType": "IMAGE",
 "visibility": "PUBLIC",
 "size": 204800,
 "createTime": "2026-05-14T12:10:00+08:00"
}
业务规则：ID_CARD、STUDENT_CARD、DELIVERY、APPEAL_EVIDENCE 类型文件必须为 PRIVATE。私有文
件返回的 url 可以为空，前端需要通过 GET /files/{fileId} 获取带权限校验的临时访问地址。
可能错误：40001, 40101, 40301, 50301
4.2 获取文件访问信息
GET /files/{fileId}
权限：User；公开文件允许 Public 访问，私有文件仅允许文件所有者、订单相关双方或 ADMIN 访问。
响应 data：
{
 "fileId": "file_001",
 "url": "https://cdn.example.com/private/file_001.jpg?token=temporary",
 "fileType": "IMAGE",
 "visibility": "PRIVATE",
 "expireTime": "2026-05-14T12:20:00+08:00"
}
可能错误：40101, 40301, 40401
5. 服务方主页、作品集与档期
5.1 获取服务方公开主页
GET /providers/{providerId}
权限：Public
响应字段包含认证状态、信用分、评分、服务城市、服务区域、风格标签、价格区间、公开作品集摘要、服务橱窗摘
要。
5.2 获取我的服务方主页
GET /providers/me
权限：Provider
5.3 更新我的服务方主页
PUT /providers/me
权限：Provider
{
 "displayName": "摄影师阿白",
 "bio": "校园写真 / 日系清新 / 自然抓拍",
 "serviceCities": ["南京"],
 "serviceAreas": ["鼓楼", "仙林"],
 "styleTags": ["自然抓拍", "日系清新"],
 "priceMin": 299.00,
 "priceMax": 899.00,
 "isAcceptingOrders": true
}

5.4 创建作品集作品
POST /portfolios
权限：Provider
{
 "title": "校园樱花写真",
 "workType": "CUSTOMER_WORK",
 "retouchType": "REFINED",
 "scene": "PERSONAL_PORTRAIT",
 "styleTags": ["日系", "清新"],
 "imageFileIds": ["file_001", "file_002"],
 "isVerifiedCustomerWork": true,
 "relatedOrderId": "ORD889900",
 "photoAuthorizationId": 2001,
 "description": "已获客片展示授权"
}
响应 data：
{
 "portfolioId": 3001,
 "status": "PENDING_REVIEW"
}
业务规则：当 workType = CUSTOMER_WORK 且 isVerifiedCustomerWork = true 时，必须关联
relatedOrderId 或 photoAuthorizationId，由系统校验客片确实来自已完成订单且已获得展示授权，不能只由服务
方自行填写为真实客片。
可能错误：40001, 40301, 42203
5.5 查询服务方作品集
GET /providers/{providerId}/portfolios
权限：Public
查询参数：workType, retouchType, style, page, size
5.6 更新作品集作品
PUT /portfolios/{portfolioId}
权限：Provider，仅作品所有者
{
 "title": "校园樱花写真",
 "workType": "CUSTOMER_WORK",
 "retouchType": "REFINED",
 "scene": "PERSONAL_PORTRAIT",
 "styleTags": ["日系", "清新"],
 "imageFileIds": ["file_001", "file_002"],
 "isVerifiedCustomerWork": true,
 "relatedOrderId": "ORD889900",
 "photoAuthorizationId": 2001,
 "description": "已获客片展示授权"
}
响应 data：
{
 "portfolioId": 3001,
 "status": "ONLINE"
}
可能错误：40001, 40301, 40401, 42203

5.7 删除作品集作品
DELETE /portfolios/{portfolioId}
权限：Provider，仅作品所有者
响应 data：null
可能错误：40301, 40401
5.8 创建可预约档期
POST /providers/me/schedules
权限：Provider
{
 "startTime": "2026-05-20T14:00:00+08:00",
 "endTime": "2026-05-20T18:00:00+08:00",
 "city": "南京",
 "locationHint": "鼓楼/仙林均可",
 "status": "AVAILABLE",
 "remark": "下午可约"
}
响应 data：
{
 "scheduleId": 501,
 "status": "AVAILABLE"
}
可能错误：40001, 40901
5.9 查询服务方公开档期
GET /providers/{providerId}/schedules
权限：Public
查询参数：startDate, endDate, city
响应只返回公开可预约时间段，不返回服务方私有备注。
5.10 修改档期
PUT /providers/me/schedules/{scheduleId}
权限：Provider，仅档期所有者
{
 "startTime": "2026-05-20T15:00:00+08:00",
 "endTime": "2026-05-20T18:00:00+08:00",
 "city": "南京",
 "locationHint": "鼓楼校区优先",
 "status": "AVAILABLE",
 "remark": "改为 15 点后可约"
}
响应 data：
{
 "scheduleId": 501,
 "status": "AVAILABLE"
}
可能错误：40001, 40301, 40401, 40901

5.11 删除档期
DELETE /providers/me/schedules/{scheduleId}
权限：Provider，仅档期所有者。已被支付订单锁定的档期不可删除。
响应 data：null
可能错误：40301, 40401, 40901
6. 双向橱窗与互选流转
6.1 消费者发布约拍需求
POST /demands
权限：Customer
{
 "scene": "PERSONAL_PORTRAIT",
 "city": "南京",
 "location": "南京大学鼓楼校区",
 "styleTags": ["自然抓拍", "日系清新"],
 "shootDate": "2026-05-20",
 "budgetMin": 300.00,
 "budgetMax": 600.00,
 "referenceImageFileIds": ["file_ref_001"],
 "shootingPlan": {
 "poseReferences": ["自然走动", "坐姿半身"],
 "makeupNeeded": false,
 "outfitStyle": "浅色校园风",
 "retouchPreference": "自然肤色，轻度磨皮",
 "safetyNoteConfirmed": true
 },
 "description": "想拍校园写真，偏自然风格"
}
响应 data：
{
 "demandId": 5566,
 "status": "OPEN"
}
6.2 摄影师分页浏览需求大厅
GET /demands
权限：Provider
查询参数：page, size, city, scene, style, budgetMin, budgetMax, shootDate
6.3 获取拍摄企划模板
GET /shooting-plan/templates
权限：Public
查询参数：scene
响应 data：
{
 "scene": "PERSONAL_PORTRAIT",
 "templates": [
 {
 "templateId": "TPL_PORTRAIT_001",
 "name": "校园写真基础企划",
 "poseReferences": ["站姿全身", "坐姿半身", "走动抓拍"],

 "outfitSuggestions": ["浅色衬衫", "学院风外套"],
 "retouchOptions": ["自然肤色", "胶片色调", "日系清新"],
 "safetyNotes": ["建议选择开放公共场地", "线下见面前请确认订单与联系人"]
 }
 ]
}
说明：前端可在发布需求、发起咨询、确认报价前引用模板，减少纯文本描述导致的信息遗漏。
可能错误：40001
6.4 查看需求详情
GET /demands/{demandId}
权限：Provider 可查看开放需求；需求发布者和 ADMIN 可查看完整详情。
响应 data：
{
 "demandId": 5566,
 "status": "OPEN",
 "customer": {
 "userId": 105,
 "nickname": "张同学",
 "avatarUrl": "https://cdn.example.com/avatar.jpg"
 },
 "scene": "PERSONAL_PORTRAIT",
 "city": "南京",
 "location": "南京大学鼓楼校区",
 "styleTags": ["自然抓拍", "日系清新"],
 "shootDate": "2026-05-20",
 "budgetMin": 300.00,
 "budgetMax": 600.00,
 "shootingPlan": {
 "poseReferences": ["自然走动", "坐姿半身"],
 "makeupNeeded": false,
 "outfitStyle": "浅色校园风",
 "retouchPreference": "自然肤色，轻度磨皮",
 "safetyNoteConfirmed": true
 },
 "referenceImages": [
 {
 "fileId": "file_ref_001",
 "url": "https://cdn.example.com/public/ref.jpg"
 }
 ],
 "description": "想拍校园写真，偏自然风格",
 "responseCount": 3,
 "createTime": "2026-05-14T12:00:00+08:00"
}
可能错误：40301, 40401
6.5 更新需求
PUT /demands/{demandId}
权限：Customer，仅需求发布者。已互选成功或已关闭的需求不可编辑核心信息。
{
 "shootDate": "2026-05-21",
 "budgetMin": 400.00,
 "budgetMax": 700.00,
 "description": "日期改为 5 月 21 日，仍希望自然抓拍风格"
}
响应 data：
{
 "demandId": 5566,

 "status": "OPEN"
}
可能错误：40301, 40401, 40902
6.6 关闭需求
POST /demands/{demandId}/close
权限：Customer，仅需求发布者
{
 "reason": "已找到合适摄影师"
}
响应 data：
{
 "demandId": 5566,
 "status": "CLOSED"
}
可能错误：40301, 40401, 40902
6.7 摄影师响应需求
POST /demands/{demandId}/responses
权限：Provider
{
 "message": "您好，我 5 月 20 日下午有档期，可以拍日系校园写真。",
 "portfolioIds": [1, 2, 3],
 "expectedPrice": 499.00
}
响应 data：
{
 "responseId": 8899,
 "status": "PENDING_CUSTOMER_ACCEPT"
}
可能错误：40401, 40904
6.8 查询需求响应列表
GET /demands/{demandId}/responses
权限：Customer，仅需求发布者；ADMIN 可查看。
查询参数：page, size, status
响应 data：
{
 "total": 3,
 "page": 1,
 "size": 10,
 "pages": 1,
 "list": [
 {
 "responseId": 8899,
 "status": "PENDING_CUSTOMER_ACCEPT",
 "provider": {
 "providerId": 12,
 "displayName": "摄影师阿白",
 "avatarUrl": "https://cdn.example.com/avatar.jpg",
 "avgRating": 4.8,
 "creditScore": 92
 },
 "message": "您好，我 5 月 20 日下午有档期，可以拍日系校园写真。",

 "expectedPrice": 499.00,
 "portfolioPreview": [
 {
 "portfolioId": 1,
 "coverUrl": "https://cdn.example.com/public/work.jpg"
 }
 ],
 "createTime": "2026-05-14T12:30:00+08:00"
 }
 ]
}
可能错误：40301, 40401
6.9 消费者接受需求响应
POST /demands/{demandId}/responses/{responseId}/accept
权限：Customer，仅需求发布者
响应 data：
{
 "conversationId": 1024,
 "sourceType": "DEMAND_RESPONSE",
 "sourceId": 8899
}
说明：接受后需求状态变为 MATCHED，系统创建会话，但不会直接生成订单。订单必须由报价确认生成。
6.10 摄影师发布服务橱窗
POST /services
权限：Provider
{
 "title": "校园写真周末约拍",
 "city": "南京",
 "serviceArea": "仙林/鼓楼",
 "scene": "PERSONAL_PORTRAIT",
 "styleTags": ["自然抓拍", "日系清新"],
 "basePrice": 299.00,
 "durationMinutes": 120,
 "originalCount": 80,
 "refinedCount": 9,
 "deliveryDays": 7,
 "availableDates": ["2026-05-20", "2026-05-21"],
 "portfolioIds": [1, 2, 3],
 "description": "适合校园写真、日常朋友圈出片"
}
响应 data：
{
 "serviceId": 102,
 "status": "ONLINE"
}
6.11 消费者分页浏览服务大厅
GET /services
权限：Public
说明：消费者通过服务大厅按城市、价格、风格、评分、可约日期等条件筛选服务方发布的服务橱窗。
查询参数：page, size, city, scene, style, priceMin, priceMax, availableDate, sort
sort 可选值：PRICE_ASC, PRICE_DESC, RATING_DESC, CREDIT_DESC, LATEST

6.12 查看服务橱窗详情
GET /services/{serviceId}
权限：Public
响应 data：
{
 "serviceId": 102,
 "status": "ONLINE",
 "title": "校园写真周末约拍",
 "city": "南京",
 "serviceArea": "仙林/鼓楼",
 "scene": "PERSONAL_PORTRAIT",
 "styleTags": ["自然抓拍", "日系清新"],
 "basePrice": 299.00,
 "durationMinutes": 120,
 "originalCount": 80,
 "refinedCount": 9,
 "deliveryDays": 7,
 "availableDates": ["2026-05-20", "2026-05-21"],
 "portfolioPreview": [
 {
 "portfolioId": 1,
 "coverUrl": "https://cdn.example.com/public/work.jpg"
 }
 ],
 "provider": {
 "providerId": 12,
 "displayName": "摄影师阿白",
 "avatarUrl": "https://cdn.example.com/avatar.jpg",
 "avgRating": 4.8,
 "creditScore": 92,
 "verificationStatus": "APPROVED"
 },
 "reviewSummary": {
 "avgRating": 4.8,
 "reviewCount": 45
 },
 "description": "适合校园写真、日常朋友圈出片"
}
可能错误：40401
6.13 更新服务橱窗
PUT /services/{serviceId}
权限：Provider，仅服务橱窗发布者
{
 "title": "校园写真周末约拍",
 "basePrice": 329.00,
 "durationMinutes": 120,
 "originalCount": 80,
 "refinedCount": 9,
 "deliveryDays": 7,
 "availableDates": ["2026-05-21", "2026-05-22"],
 "portfolioIds": [1, 2, 4],
 "description": "周末档期更新，适合校园写真和日常写真"
}
响应 data：
{
 "serviceId": 102,
 "status": "ONLINE"
}
可能错误：40001, 40301, 40401

6.14 下架服务橱窗
POST /services/{serviceId}/offline
权限：Provider，仅服务橱窗发布者
{
 "reason": "近期档期已满"
}
响应 data：
{
 "serviceId": 102,
 "status": "OFFLINE"
}
可能错误：40001, 40101, 40301, 40401, 40902
6.15 重新上架服务橱窗
POST /services/{serviceId}/online
权限：Provider，仅服务橱窗发布者
响应 data：
{
 "serviceId": 102,
 "status": "ONLINE"
}
可能错误：40101, 40301, 40401, 40902
6.16 删除服务橱窗
DELETE /services/{serviceId}
权限：Provider，仅服务橱窗发布者。已有进行中会话、报价或订单关联的橱窗不可物理删除，可下架。
响应 data：null
可能错误：40301, 40401, 40902
6.17 消费者从服务橱窗发起会话
POST /services/{serviceId}/inquiries
权限：Customer
说明：消费者从服务橱窗发起沟通请求时，系统直接创建一对一 Conversation，并把请求体中的 message 保存为会话首条 Message。本接口不创建独立咨询资源；服务橱窗来源通过 Conversation.sourceType = SERVICE_PACKAGE 与 sourceId = serviceId 标识。同一 customer 与同一 serviceId 已存在未关闭会话时，返回已有 conversationId；若业务规则禁止重复会话，则返回 40904。后端需在同一环境中保持一致策略。
{
 "message": "5 月 20 日下午还有档期吗？想拍校园写真。",
 "expectedDate": "2026-05-20",
 "shootingPlan": {
  "poseReferences": ["自然走动"],
  "makeupNeeded": false,
  "outfitStyle": "浅色校园风",
  "retouchPreference": "日系清新",
  "safetyNoteConfirmed": true
 }
}
响应 data：
{
 "conversationId": 1025,
 "sourceType": "SERVICE_PACKAGE",
 "sourceId": 102,
 "firstMessageId": 9002
}
业务规则：
1. 系统校验 serviceId 存在、服务橱窗处于可咨询状态，且用户具备 CUSTOMER 角色。
2. 系统不生成咨询 ID 字段，不保存独立待接收咨询状态。
3. Conversation.sourceType 固定为 SERVICE_PACKAGE，sourceId 固定为 serviceId。
4. 订单仍必须由服务方在会话中发送正式报价单，并由需求方确认报价后生成；本接口不会直接生成订单。
5. 前端若需要展示服务橱窗来源的沟通记录，应使用 GET /conversations，并按 sourceType = SERVICE_PACKAGE 或 sourceId 过滤。
可能错误：40001, 40101, 40301, 40401, 40901, 40904
7. 沟通与报价
7.1 获取会话列表
GET /conversations
权限：User
查询参数：page, size, unreadOnly
响应 data：
{
 "total": 2,
 "page": 1,
 "size": 10,
 "pages": 1,
 "list": [
 {
 "conversationId": 1024,

 "targetUser": {
 "userId": 12,
 "nickname": "摄影师阿白",
 "avatarUrl": "https://cdn.example.com/avatar.jpg"
 },
 "sourceType": "DEMAND_RESPONSE",
 "sourceId": 8899,
 "lastMessage": "我的报价单发过去了，请确认",
 "lastMessageTime": "2026-05-14T10:00:00+08:00",
 "unreadCount": 1
 }
 ]
}
7.2 获取历史消息
GET /conversations/{conversationId}/messages
权限：User，仅会话双方或 ADMIN
查询参数：page, size, beforeMessageId
响应 data：
{
 "total": 35,
 "page": 1,
 "size": 20,
 "pages": 2,
 "list": [
 {
 "messageId": 9001,
 "senderId": 12,
 "messageType": "TEXT",
 "content": "我的报价单发过去了，请确认",
 "quotationId": 7788,
 "createTime": "2026-05-14T10:00:00+08:00"
 }
 ]
}
可能错误：40101, 40301, 40401
7.3 发送消息
POST /conversations/{conversationId}/messages
权限：User，仅会话双方
{
 "messageType": "TEXT",
 "content": "可以把交付日期改到 5 月 25 日吗？",
 "fileIds": []
}
响应 data：
{
 "messageId": 9002,
 "createTime": "2026-05-14T10:03:00+08:00"
}
说明：MVP 可使用轮询读取新消息；接口响应结构保持与未来 WebSocket 推送兼容。
7.4 服务方发送正式报价单
POST /quotations
权限：Provider，仅会话中的服务方

{
 "conversationId": 1024,
 "shootStartTime": "2026-05-20T14:00:00+08:00",
 "shootEndTime": "2026-05-20T18:00:00+08:00",
 "location": "南京大学鼓楼校区",
 "originalCount": 80,
 "refinedCount": 9,
 "deliveryDeadline": "2026-05-25T23:59:59+08:00",
 "totalAmount": 500.00,
 "photoUsageScope": "PERSONAL_ONLY",
 "terms": "费用包含 4 小时拍摄、80 张原片、9 张精修。",
 "contractTerms": "双方确认拍摄时间、交付数量、取消规则、肖像与版权授权范围。",
 "safetyNoticeVersion": "SAFETY_2026_01",
 "expireTime": "2026-05-15T23:59:59+08:00"
}
响应 data：
{
 "quotationId": 7788,
 "status": "PENDING_CONFIRM"
}
业务规则：发送报价时不创建订单；若当前会话已有待确认报价，应先撤回或过期旧报价。
可能错误：40001, 40301, 40901
7.5 查看报价单详情
GET /quotations/{quotationId}
权限：报价关联会话双方或 ADMIN
响应 data：
{
 "quotationId": 7788,
 "status": "PENDING_CONFIRM",
 "conversationId": 1024,
 "providerId": 12,
 "customerId": 105,
 "shootStartTime": "2026-05-20T14:00:00+08:00",
 "shootEndTime": "2026-05-20T18:00:00+08:00",
 "location": "南京大学鼓楼校区",
 "originalCount": 80,
 "refinedCount": 9,
 "deliveryDeadline": "2026-05-25T23:59:59+08:00",
 "totalAmount": 500.00,
 "photoUsageScope": "PERSONAL_ONLY",
 "terms": "费用包含 4 小时拍摄、80 张原片、9 张精修。",
 "contractTerms": "双方确认拍摄时间、交付数量、取消规则、肖像与版权授权范围。",
 "safetyNoticeVersion": "SAFETY_2026_01",
 "expireTime": "2026-05-15T23:59:59+08:00",
 "relatedOrderId": null
}
说明：聊天消息中的报价卡片可通过该接口进入报价详情页；若报价已确认，relatedOrderId 返回生成的订单 ID。
可能错误：40301, 40401
7.6 需求方确认报价并生成订单
POST /quotations/{quotationId}/confirm
权限：Customer，仅报价关联会话中的需求方
请求头：
Idempotency-Key: 6f1d8b5a-quote-confirm-7788
请求体：

{
 "acceptTerms": true,
 "photoUsageScopeConfirmed": true,
 "safetyNoticeConfirmed": true,
 "contractSnapshotId": "CONTRACT_7788_001"
}
响应 data：
{
 "quotationId": 7788,
 "quotationStatus": "CONFIRMED",
 "order": {
 "orderId": "ORD889900",
 "status": "PENDING_PAYMENT",
 "totalAmount": 500.00,
 "payDeadline": "2026-05-14T10:30:00+08:00"
 }
}
业务规则：
1. 系统校验报价是否属于当前用户、是否仍为 PENDING_CONFIRM、是否过期。
2. 系统调用档期模块检查服务方在报价时间段是否可约。
3. 校验通过后创建订单，状态为 PENDING_PAYMENT，并创建临时档期占用 scheduleHold。
4. 若用户未在 payDeadline 前支付，订单自动取消，临时档期占用释放。
5. 真正锁定档期发生在支付成功后，由 OrderPaidEvent 触发。
可能错误：40003, 40101, 40301, 40401, 40901, 40903, 40908
7.7 需求方拒绝报价
POST /quotations/{quotationId}/reject
权限：Customer，仅报价关联会话中的需求方
{
 "reason": "预算不合适，想再沟通一下"
}
响应 data：
{
 "quotationId": 7788,
 "status": "REJECTED"
}
说明：拒绝报价不会关闭会话，双方仍可继续沟通并重新报价。
7.8 服务方撤回报价
POST /quotations/{quotationId}/cancel
权限：Provider，仅报价发送者
响应 data：
{
 "quotationId": 7788,
 "status": "CANCELLED"
}
可能错误：40101, 40301, 40401, 40903

8. 订单与履约
8.1 查询我的订单列表
GET /orders
权限：User
查询参数：
参数
类型
说明
roleView
String
CUSTOMER 或 PROVIDER，用户同时具备多角
色时用于切换视角
status
String
订单状态筛选
page
Integer
页码
size
Integer
每页条数
startDate
Date
拍摄开始日期
endDate
Date
拍摄结束日期
响应 data：
{
 "total": 3,
 "page": 1,
 "size": 10,
 "pages": 1,
 "list": [
 {
 "orderId": "ORD889900",
 "status": "PAID_PENDING_SHOOT",
 "totalAmount": 500.00,
 "shootStartTime": "2026-05-20T14:00:00+08:00",
 "shootEndTime": "2026-05-20T18:00:00+08:00",
 "provider": {
 "providerId": 12,
 "name": "摄影师阿白",
 "avatarUrl": "https://cdn.example.com/avatar.jpg"
 },
 "customer": {
 "userId": 105,
 "name": "张同学",
 "avatarUrl": "https://cdn.example.com/avatar2.jpg"
 },
 "nextAction": "WAIT_SHOOTING"
 }
 ]
}
可能错误：40101
8.2 查看订单详情
GET /orders/{orderId}
权限：User，仅订单双方或 ADMIN
响应 data：
{
 "orderId": "ORD889900",
 "status": "PAID_PENDING_SHOOT",
 "quotationId": 7788,
 "conversationId": 1024,
 "totalAmount": 500.00,
 "escrowStatus": "HELD",

 "settlementStatus": "NOT_SETTLED",
 "refundStatus": "NONE",
 "autoConfirmTime": "2026-06-01T23:59:59+08:00",
 "provider": {
 "providerId": 12,
 "name": "摄影师阿白",
 "maskedMobile": "138****1234"
 },
 "customer": {
 "userId": 105,
 "name": "张同学",
 "maskedMobile": "139****5678"
 },
 "terms": {
 "shootStartTime": "2026-05-20T14:00:00+08:00",
 "shootEndTime": "2026-05-20T18:00:00+08:00",
 "location": "南京大学鼓楼校区",
 "originalCount": 80,
 "refinedCount": 9,
 "deliveryDeadline": "2026-05-25T23:59:59+08:00",
 "photoUsageScope": "PERSONAL_ONLY",
 "cancellationPolicy": "拍摄开始 24 小时前可取消，按平台规则退款。",
 "contractSnapshotId": "CONTRACT_7788_001",
 "contractTerms": "双方确认拍摄时间、交付数量、取消规则、肖像与版权授权范围。",
 "safetyNoticeConfirmed": true
 },
 "payment": {
 "paymentStatus": "PAID",
 "payTime": "2026-05-14T10:00:00+08:00"
 },
 "delivery": {
 "deliveryStatus": "NOT_UPLOADED",
 "originalCount": 0,
 "refinedCount": 0
 }
}
可能错误：40101, 40301, 40401
8.3 查询订单时间线
GET /orders/{orderId}/timeline
权限：订单双方或 ADMIN
响应 data：
{
 "orderId": "ORD889900",
 "list": [
 {
 "eventType": "ORDER_CREATED",
 "fromStatus": null,
 "toStatus": "PENDING_PAYMENT",
 "operatorRole": "CUSTOMER",
 "operatorId": 105,
 "description": "需求方确认报价，系统生成待支付订单",
 "createTime": "2026-05-14T10:00:00+08:00"
 },
 {
 "eventType": "ORDER_PAID",
 "fromStatus": "PENDING_PAYMENT",
 "toStatus": "PAID_PENDING_SHOOT",
 "operatorRole": "CUSTOMER",
 "operatorId": 105,
 "description": "订单支付成功，档期已锁定",
 "createTime": "2026-05-14T10:10:00+08:00"
 }
 ]
}

说明：时间线用于订单详情页展示状态进度，也作为申诉仲裁时的辅助证据。
可能错误：40301, 40401
8.4 支付订单
POST /orders/{orderId}/payments
权限：Customer，仅订单需求方
请求头：
Idempotency-Key: 25c0cddf-pay-ORD889900
请求体：
{
 "payMethod": "WECHAT_PAY"
}
响应 data：
{
 "paymentId": "PAY_112",
 "orderId": "ORD889900",
 "paymentStatus": "PAYING",
 "wechatPayParams": {
 "timeStamp": "1715652000",
 "nonceStr": "abc123",
 "package": "prepay_id=wx123",
 "signType": "RSA",
 "paySign": "signature"
 }
}
业务规则：
1. 仅 PENDING_PAYMENT 订单可支付。
2. 支付金额必须等于订单金额。
3. 支付成功后订单状态变为 PAID_PENDING_SHOOT。
4. 支付成功触发 OrderPaidEvent，通知消息模块推送站内通知，并通知档期模块将临时占用转为正式锁定。
5. 支付成功后资金进入平台托管，订单详情中 escrowStatus 变为 HELD。
可能错误：40003, 40301, 40901, 40902, 40906
8.5 支付回调
POST /payments/wechat/callback
权限：第三方支付服务回调签名校验，不使用普通用户 JWT。
说明：MVP 可使用模拟支付接口，但应保留真实支付回调入口。回调必须校验签名、支付金额、支付单状态，并保
证幂等。
请求头：
Wechatpay-Signature: <signature>
Wechatpay-Nonce: <nonce>
Wechatpay-Timestamp: <timestamp>
业务规则：
1. 回调只接受支付平台签名校验通过的请求，失败返回 40102 CALLBACK_SIGNATURE_INVALID。
2. paymentId 已处理成功时重复回调直接返回成功，不重复推进订单状态。
3. 金额不一致返回 40906 PAYMENT_AMOUNT_MISMATCH，订单保持原状态并记录异常日志。

4. 返回给微信的成功格式为 {"code":"SUCCESS","message":"成功"}；失败格式为 {"code":"FAIL","message":"失
败原因"}。
可能错误：40102, 40401, 40906, 50001
8.6 取消订单
POST /orders/{orderId}/cancel
权限：订单双方。支付后取消按平台规则退款，管理员可在后台介入。
{
 "reason": "拍摄时间冲突",
 "cancelBy": "CUSTOMER"
}
响应 data：
{
 "orderId": "ORD889900",
 "status": "CANCELLED",
 "refundStatus": "PENDING_REFUND"
}
业务规则：取消成功触发 OrderCancelledEvent，档期模块释放已锁定档期，消息模块通知对方。
可能错误：40301, 40902
8.7 标记开始拍摄
POST /orders/{orderId}/shooting/start
权限：Provider，仅订单服务方
响应 data：
{
 "orderId": "ORD889900",
 "status": "SHOOTING"
}
可能错误：40301, 40902
8.8 标记拍摄完成并进入待交付
POST /orders/{orderId}/shooting/finish
权限：Provider，仅订单服务方
响应 data：
{
 "orderId": "ORD889900",
 "status": "PENDING_DELIVERY"
}
可能错误：40101, 40301, 40401, 40902
8.9 上传交付作品
POST /orders/{orderId}/deliveries
权限：Provider，仅订单服务方
{
 "originalImageFileIds": ["file_raw_001", "file_raw_002"],
 "refinedImageFileIds": ["file_refined_001", "file_refined_002"],
 "remark": "原片和精修片已上传，请查收。"
}
响应 data：

{
 "deliveryId": 7001,
 "orderId": "ORD889900",
 "status": "DELIVERED_PENDING_CONFIRM",
 "originalCount": 80,
 "refinedCount": 9
}
业务规则：系统校验上传数量是否满足报价条款；上传成功触发 DeliveryUploadedEvent，订单状态变为
DELIVERED_PENDING_CONFIRM。
可能错误：40301, 40902, 42202
8.10 查询交付作品
GET /orders/{orderId}/deliveries
权限：订单双方或 ADMIN
说明：交付文件属于订单私有内容，不可作为公开作品集直接展示。若服务方希望公开客片，必须取得照片授权。
响应 data：
{
 "orderId": "ORD889900",
 "latestDeliveryId": 7001,
 "list": [
 {
 "deliveryId": 7001,
 "round": 1,
 "isLatest": true,
 "status": "DELIVERED_PENDING_CONFIRM",
 "originalFiles": [
 {
 "fileId": "file_raw_001",
 "temporaryUrl": "https://cdn.example.com/private/raw1.jpg?token=temporary",
 "expireTime": "2026-05-25T21:00:00+08:00"
 }
 ],
 "refinedFiles": [
 {
 "fileId": "file_refined_001",
 "temporaryUrl": "https://cdn.example.com/private/refined1.jpg?token=temporary",
 "expireTime": "2026-05-25T21:00:00+08:00"
 }
 ],
 "remark": "原片和精修片已上传，请查收。",
 "uploadTime": "2026-05-25T20:00:00+08:00"
 }
 ]
}
可能错误：40101, 40301, 40401
8.11 确认收货
POST /orders/{orderId}/confirmations
权限：Customer，仅订单需求方
请求头：
Idempotency-Key: confirm-ORD889900-001
响应 data：
{
 "orderId": "ORD889900",
 "status": "COMPLETED",
 "reviewEnabledUntil": "2026-05-27T23:59:59+08:00"
}

业务规则：确认收货后触发 OrderCompletedEvent，系统开放双方 7 天互评入口，并更新信用分。
自动确认规则：订单进入 DELIVERED_PENDING_CONFIRM 后 7 天内，需求方未确认收货且未发起申诉，系统自
动确认收货，记录 autoConfirmTime，并触发结算流程。
可能错误：40003, 40301, 40902, 42202
8.12 照片授权确认
POST /orders/{orderId}/photo-authorization
权限：Customer，仅订单需求方
{
 "photoUsageScope": "PROVIDER_PORTFOLIO_ALLOWED",
 "authorizedFileIds": ["file_refined_001", "file_refined_002"],
 "remark": "允许摄影师用于个人作品集展示，不允许商业广告。"
}
响应 data：
{
 "orderId": "ORD889900",
 "photoUsageScope": "PROVIDER_PORTFOLIO_ALLOWED",
 "authorizedAt": "2026-05-25T20:00:00+08:00"
}
photoUsageScope 可选值：
值
说明
PERSONAL_ONLY
仅需求方个人使用，服务方不可公开展示
PROVIDER_PORTFOLIO_ALLOWED
允许服务方放入作品集展示
COMMERCIAL_ALLOWED
允许商业宣传使用，需单独约定
可能错误：40101, 40301, 40401, 40902, 40908
9. 评价、信用与申诉仲裁
9.1 提交评价
POST /reviews
权限：订单双方。订单完成后 7 天内可评价。
{
 "orderId": "ORD889900",
 "targetUserId": 12,
 "rating": 5,
 "content": "摄影师非常耐心，出片很快。",
 "imageFileIds": ["file_show_001"]
}
响应 data：
{
 "reviewId": 9900,
 "reviewerId": 105,
 "targetUserId": 12,
 "direction": "CUSTOMER_TO_PROVIDER"
}
业务规则：需求方评价服务方时 direction = CUSTOMER_TO_PROVIDER，服务方评价需求方时 direction =
PROVIDER_TO_CUSTOMER。系统也可以由 orderId + 当前登录用户 自动推断被评价方，但若请求携带
targetUserId，必须与订单另一方一致。同一订单同一评价方向只能评价一次，不能评价自己，评价窗口为订单完成
后 7 天。

可能错误：40001, 40003, 40301, 40401, 40905
9.2 查看用户公开评价
GET /users/{userId}/reviews
权限：Public
查询参数：page, size, rating
响应 data：
{
 "total": 45,
 "avgRating": 4.8,
 "page": 1,
 "size": 10,
 "pages": 5,
 "list": [
 {
 "reviewId": 9900,
 "orderId": "ORD889900",
 "reviewer": {
 "userId": 105,
 "nickname": "李同学",
 "avatarUrl": "https://cdn.example.com/avatar.jpg"
 },
 "rating": 5,
 "content": "摄影师超级耐心，出片神速。",
 "images": ["https://cdn.example.com/public/review1.jpg"],
 "reply": "感谢认可，期待下次合作。",
 "createTime": "2026-05-10T12:00:00+08:00"
 }
 ]
}
9.3 回复评价
POST /reviews/{reviewId}/reply
权限：被评价方
{
 "content": "感谢认可，期待下次合作。"
}
响应 data：
{
 "reviewId": 9900,
 "reply": "感谢认可，期待下次合作。"
}
可能错误：40001, 40301, 40401
9.4 举报恶意评价
POST /reviews/{reviewId}/reports
权限：User
{
 "reason": "恶意差评",
 "evidenceFileIds": ["file_evidence_001"]
}
响应 data：
{
 "reportId": 6101,
 "status": "PENDING_REVIEW"

}
可能错误：40001, 40101, 40401
9.5 查询用户信用分
GET /users/{userId}/credit
权限：Public
响应 data：
{
 "userId": 12,
 "creditScore": 92,
 "completionRate": 0.98,
 "onTimeDeliveryRate": 0.95,
 "appealRate": 0.02,
 "avgRating": 4.8
}
9.6 查询信用变动记录
GET /users/{userId}/credit-records
权限：本人或 ADMIN。公开主页只展示汇总分，不展示详细扣分记录。
查询参数：page, size, changeType
响应 data：
{
 "total": 6,
 "page": 1,
 "size": 10,
 "pages": 1,
 "list": [
 {
 "recordId": 501,
 "changeValue": 2,
 "changeType": "ORDER_COMPLETED",
 "reason": "订单按时完成",
 "relatedOrderId": "ORD889900",
 "createTime": "2026-05-25T20:00:00+08:00"
 }
 ]
}
9.7 发起订单申诉
POST /orders/{orderId}/appeals
权限：订单双方。MVP 阶段优先支持需求方质量申诉，同时保留服务方因爽约、恶意评价、照片违规使用等场景发
起申诉的类型。
{
 "appealRole": "CUSTOMER",
 "appealTypes": ["QUALITY_NOT_MATCH", "DELIVERY_INCOMPLETE"],
 "description": "精修图数量不足，且成片风格与约定差异较大。",
 "evidenceFileIds": ["file_evidence_001", "file_evidence_002"],
 "expectedResult": "REWORK"
}
响应 data：
{
 "appealId": 3001,
 "orderId": "ORD889900",
 "status": "PENDING_PROVIDER_REPLY"
}

业务规则：发起申诉后订单状态变为 APPEALING，管理员可查看订单、聊天记录、报价单、交付作品、订单时间线
和评价记录作为证据。appealTypes 可选值包括 QUALITY_NOT_MATCH、DELIVERY_INCOMPLETE、
CUSTOMER_NO_SHOW、MALICIOUS_REVIEW、PHOTO_USAGE_VIOLATION。
可能错误：40301, 40902, 42201
9.8 查看申诉详情
GET /orders/{orderId}/appeals/{appealId}
权限：订单双方或 ADMIN
9.9 服务方回复申诉
POST /orders/{orderId}/appeals/{appealId}/replies
权限：Provider，仅订单服务方
{
 "content": "已按报价单交付 9 张精修，可提供源文件截图说明。",
 "evidenceFileIds": ["file_provider_evidence_001"]
}
10. 后台管理接口
10.1 查询服务方认证审核列表
GET /admin/provider-verifications
权限：Admin
查询参数：status, page, size
响应 data：
{
 "total": 8,
 "page": 1,
 "size": 10,
 "pages": 1,
 "list": [
 {
 "verificationId": 801,
 "providerId": 12,
 "realNameMasked": "王*白",
 "idCardNoMasked": "320100********1234",
 "status": "PENDING_REVIEW",
 "submitTime": "2026-05-14T12:00:00+08:00"
 }
 ]
}
10.2 通过服务方认证
POST /admin/provider-verifications/{id}/approve
权限：Admin
{
 "remark": "证件清晰，信息一致。"
}
10.3 拒绝服务方认证
POST /admin/provider-verifications/{id}/reject
权限：Admin

{
 "reason": "身份证照片不清晰，请重新上传。"
}
可能错误：40001, 40101, 40301, 40401
10.4 查询学生认证审核列表
GET /admin/student-verifications
权限：Admin
查询参数：status, school, page, size
响应 data：
{
 "total": 10,
 "page": 1,
 "size": 10,
 "pages": 1,
 "list": [
 {
 "verificationId": 901,
 "userId": 105,
 "realNameMasked": "张*",
 "school": "南京大学",
 "studentNoMasked": "241****56",
 "status": "PENDING_REVIEW",
 "submitTime": "2026-05-14T12:00:00+08:00"
 }
 ]
}
可能错误：40101, 40301
10.5 通过学生认证
POST /admin/student-verifications/{id}/approve
权限：Admin
{
 "remark": "学生证信息清晰，学校信息一致。"
}
响应 data：
{
 "verificationId": 901,
 "status": "APPROVED"
}
可能错误：40001, 40101, 40301, 40401
10.6 拒绝学生认证
POST /admin/student-verifications/{id}/reject
权限：Admin
{
 "reason": "学生证照片不清晰，请重新上传。"
}
响应 data：
{
 "verificationId": 901,
 "status": "REJECTED"
}

可能错误：40001, 40101, 40301, 40401
10.7 查询申诉列表
GET /admin/appeals
权限：Admin
查询参数：status, page, size
响应 data：
{
 "total": 5,
 "page": 1,
 "size": 10,
 "pages": 1,
 "list": [
 {
 "appealId": 3001,
 "orderId": "ORD889900",
 "status": "PENDING_ADMIN_REVIEW",
 "appealTypes": ["QUALITY_NOT_MATCH"],
 "customerId": 105,
 "providerId": 12,
 "createTime": "2026-05-25T20:30:00+08:00"
 }
 ]
}
10.8 管理员仲裁处理
POST /admin/appeals/{appealId}/resolve
权限：Admin
{
 "result": "PARTIAL_REFUND",
 "refundAmount": 200.00,
 "adminRemark": "经核对聊天记录和交付文件，服务方存在部分交付瑕疵，判定部分退款。",
 "creditPenaltyTarget": "PROVIDER"
}
result 可选值：
值
说明
FULL_REFUND
全额退款
PARTIAL_REFUND
部分退款
REJECT
驳回申诉
REWORK
要求服务方返修
业务规则：仲裁完成触发 DisputeResolvedEvent，订单模块更新状态，评价与信用模块记录违约影响。
10.9 查询评价举报列表
GET /admin/reports
权限：Admin
查询参数：status, page, size
响应 data：
{
 "total": 4,
 "page": 1,
 "size": 10,

 "pages": 1,
 "list": [
 {
 "reportId": 6101,
 "reviewId": 9900,
 "reason": "恶意差评",
 "status": "PENDING_REVIEW",
 "reporterId": 12,
 "createTime": "2026-05-26T10:00:00+08:00"
 }
 ]
}
10.10 处理评价举报
POST /admin/reports/{id}/resolve
权限：Admin
{
 "result": "HIDE_REVIEW",
 "remark": "评价包含辱骂内容，已隐藏。"
}
响应 data：
{
 "reportId": 6101,
 "status": "RESOLVED"
}
可能错误：40001, 40101, 40301, 40401
10.11 查询作品内容审核列表
GET /admin/portfolios/review
权限：Admin
查询参数：status, providerId, page, size
响应 data：
{
 "total": 12,
 "page": 1,
 "size": 10,
 "pages": 2,
 "list": [
 {
 "portfolioId": 3001,
 "providerId": 12,
 "title": "校园樱花写真",
 "workType": "CUSTOMER_WORK",
 "retouchType": "REFINED",
 "status": "PENDING_REVIEW",
 "coverUrl": "https://cdn.example.com/public/work.jpg",
 "submitTime": "2026-05-14T12:00:00+08:00"
 }
 ]
}
10.12 处理作品内容审核
POST /admin/portfolios/{portfolioId}/resolve
权限：Admin
{
 "result": "APPROVE",
 "remark": "内容正常，允许公开展示。"

}
result 可选值：APPROVE, REJECT, OFFLINE
响应 data：
{
 "portfolioId": 3001,
 "status": "ONLINE"
}
10.13 后台运营大盘
GET /admin/dashboard
权限：Admin
响应 data：
{
 "totalUsers": 1200,
 "totalProviders": 186,
 "gmvToday": 12880.00,
 "pendingVerifications": 8,
 "pendingAppeals": 5,
 "completedOrdersToday": 16
}
11. 关键事件与通知
系统采用模块化单体 + Spring Event 的轻量事件机制，主流程由订单模块控制，副作用由事件监听器处理。
事件
触发时机
监听模块
处理
OrderPaidEvent
订单支付成功
消息与报价模块
向双方推送订单已支付通知
OrderPaidEvent
订单支付成功
档期模块
锁定服务方对应时间段
OrderCancelledEvent
订单取消
档期模块
释放档期
OrderCancelledEvent
订单取消
消息与报价模块
通知对方订单已取消
DeliveryUploadedEvent
服务方上传作品
订单与交易模块
更新订单状态为已交付
OrderCompletedEvent
需求方确认收货
评价与信用模块
开放互评入口并更新信用分
OrderCompletedEvent
需求方确认收货或自动确认
订单与交易模块
将结算状态推进为 SETTLING
OrderAutoConfirmedEvent
交付后 7 天未确认且未申诉
订单与交易模块
自动确认收货并记录 autoConfirmT
ime
SettlementCompletedEvent
服务方结算完成
订单与交易模块
更新 settlementStatus =
SETTLED、escrowStatus =
RELEASED
ReviewCreatedEvent
评价提交
评价与信用模块
重新计算被评价方信用分
DisputeResolvedEvent
管理员完成仲裁
订单与交易模块
更新订单状态
11.1 查询站内通知
GET /notifications
权限：User
查询参数：page, size, unreadOnly
响应 data：
{
 "total": 3,
 "page": 1,
 "size": 10,

 "pages": 1,
 "list": [
 {
 "notificationId": 8001,
 "type": "ORDER_PAID",
 "title": "订单已支付",
 "content": "订单 ORD889900 已支付成功，档期已锁定。",
 "isRead": false,
 "createTime": "2026-05-14T10:10:00+08:00"
 }
 ]
}
可能错误：40101
11.2 标记通知已读
POST /notifications/{notificationId}/read
权限：User
响应 data：null
可能错误：40101, 40301, 40401
12. 主要请求参数索引
本章列出核心写接口的请求体字段、必填规则与校验约束。路径参数如 {orderId}、{serviceId}、{demandId} 均为
必填；分页查询参数统一使用 page、size。
12.1 登录与认证
POST /sessions
参数名
类型
必填
说明
校验规则
loginType
String
是
登录方式
MOBILE / WECHAT
mobile
String
条件必填
手机号
loginType = MOBILE 时必
填
verifyCode
String
条件必填
短信验证码
6 位数字
wechatCode
String
条件必填
微信授权码
loginType = WECHAT 时必
填
role
String
否
初始角色
CUSTOMER / PROVIDER
POST /verification/provider
参数名
类型
必填
说明
校验规则
realName
String
是
真实姓名
2 到 20 个字符
idCardNo
String
是
身份证号
后端加密存储，不写入普通
日志
idCardFrontFileId
String
是
身份证正面文件
文件必须为 PRIVATE
idCardBackFileId
String
是
身份证反面文件
文件必须为 PRIVATE
POST /verification/student
参数名
类型
必填
说明
校验规则
realName
String
是
真实姓名
2 到 20 个字符
school
String
是
学校名称
不能为空
studentNo
String
是
学号
响应和日志中脱敏

参数名
类型
必填
说明
校验规则
studentCardFileId
String
是
学生证文件
文件必须为 PRIVATE
12.2 文件与资料
POST /files
参数名
类型
必填
说明
校验规则
file
File
是
上传文件
图片大小建议不超过 10MB
bizType
String
是
业务类型
AVATAR / PORTFOLIO /
ID_CARD / STUDENT_CAR
D / DELIVERY /
APPEAL_EVIDENCE
visibility
String
是
可见性
敏感业务文件必须为
PRIVATE
PUT /users/me
参数名
类型
必填
说明
校验规则
nickname
String
否
昵称
1 到 30 个字符
avatarFileId
String
否
头像文件
文件类型必须为图片
city
String
否
常驻城市
不能为空字符串
school
String
否
学校
学生用户可填写
12.3 需求、服务橱窗与企划
POST /demands
参数名
类型
必填
说明
校验规则
scene
String
是
拍摄场景
枚举值，如 PERSONAL_PO
RTRAIT
city
String
是
城市
不能为空
location
String
是
拍摄地点描述
2 到 100 个字符
styleTags
Array<String>
是
风格标签
至少 1 个
shootDate
Date
是
期望拍摄日期
不早于当前日期
budgetMin
Decimal
是
最低预算
大于等于 0
budgetMax
Decimal
是
最高预算
不小于 budgetMin
referenceImageFileIds
Array<String>
否
参考图
文件可公开或私有
shootingPlan
Object
否
拍摄企划
见企划字段说明
description
String
是
需求描述
10 到 1000 个字符
shootingPlan
参数名
类型
必填
说明
校验规则
poseReferences
Array<String>
否
姿势参考
最多 20 项
makeupNeeded
Boolean
否
是否需要妆造
默认 false
outfitStyle
String
否
服装风格
最多 100 字
retouchPreference
String
否
修图偏好
最多 200 字
safetyNoteConfirmed
Boolean
是
是否确认安全提示
下单前必须为 true
POST /services

参数名
类型
必填
说明
校验规则
title
String
是
橱窗标题
2 到 50 个字符
city
String
是
服务城市
不能为空
serviceArea
String
是
服务区域
不能为空
scene
String
是
适用场景
枚举值
styleTags
Array<String>
是
风格标签
至少 1 个
basePrice
Decimal
是
基础价格
大于 0
durationMinutes
Integer
是
拍摄时长
大于 0
originalCount
Integer
是
原片数量
大于等于 0
refinedCount
Integer
是
精修数量
大于等于 0
deliveryDays
Integer
是
交付天数
大于 0
availableDates
Array<Date>
否
可约日期摘要
与档期模块保持一致
portfolioIds
Array<Long>
是
关联作品
至少 1 个
description
String
是
服务描述
10 到 2000 个字符
12.4 报价、订单与支付
POST /quotations
参数名
类型
必填
说明
校验规则
conversationId
Long
是
会话 ID
当前用户必须是会话服务方
shootStartTime
DateTime
是
拍摄开始时间
早于结束时间
shootEndTime
DateTime
是
拍摄结束时间
晚于开始时间
location
String
是
拍摄地点
不能为空
originalCount
Integer
是
原片数量
大于等于 0
refinedCount
Integer
是
精修数量
大于等于 0
deliveryDeadline
DateTime
是
交付截止时间
晚于拍摄结束时间
totalAmount
Decimal
是
总金额
大于 0
photoUsageScope
String
是
照片授权范围
PERSONAL_ONLY /
PROVIDER_PORTFOLIO_
ALLOWED / COMMERCIA
L_ALLOWED
terms
String
是
报价条款
10 到 2000 字
contractTerms
String
是
合同条款快照
确认报价后写入订单
safetyNoticeVersion
String
是
安全提示版本
用于审计确认记录
expireTime
DateTime
是
报价过期时间
晚于当前时间
POST /quotations/{quotationId}/confirm
参数名
类型
必填
说明
校验规则
acceptTerms
Boolean
是
是否接受报价条款
必须为 true
photoUsageScopeConfirm
ed
Boolean
是
是否确认照片授权范围
必须为 true
safetyNoticeConfirmed
Boolean
是
是否确认安全提示
必须为 true
contractSnapshotId
String
是
合同快照 ID
后端生成或校验有效性
POST /orders/{orderId}/payments

参数名
类型
必填
说明
校验规则
payMethod
String
是
支付方式
WECHAT_PAY /
MOCK_PAY
POST /orders/{orderId}/cancel
参数名
类型
必填
说明
校验规则
reason
String
是
取消原因
5 到 200 字
cancelBy
String
是
取消方
CUSTOMER / PROVIDER
/ ADMIN
12.5 交付、评价与申诉
POST /orders/{orderId}/deliveries
参数名
类型
必填
说明
校验规则
originalImageFileIds
Array<String>
是
原片文件
文件必须为 PRIVATE
refinedImageFileIds
Array<String>
是
精修文件
数量不能少于报价约定
remark
String
否
交付备注
最多 500 字
POST /reviews
参数名
类型
必填
说明
校验规则
orderId
String
是
订单 ID
订单必须已完成
targetUserId
Long
是
被评价方
必须为订单另一方
rating
Integer
是
评分
1 到 5
content
String
是
评价内容
5 到 1000 字
imageFileIds
Array<String>
否
评价图片
公开展示前需审核
POST /orders/{orderId}/appeals
参数名
类型
必填
说明
校验规则
appealRole
String
是
申诉方角色
CUSTOMER / PROVIDER
appealTypes
Array<String>
是
申诉类型
至少 1 项
description
String
是
申诉描述
不少于 20 字
evidenceFileIds
Array<String>
是
证据文件
文件必须为 PRIVATE
expectedResult
String
是
期望结果
FULL_REFUND /
PARTIAL_REFUND /
REWORK / REJECT
