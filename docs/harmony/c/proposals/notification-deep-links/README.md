# C-SHARED-08：通知精确业务跳转缺口（未实现）

2026-10-29，用户追问订单、评价、申诉、举报能否直达对应页面。已核对正式源码086a752与integration/harmony-v1/b258ec8，不能将目前订单列表落点算作精确跳转完成。此文是维护者交接建议，不是应用补丁或验收报告。前一轮9文件授权仅覆盖通知/信用接线，未据此扩展后端举报通知或D完整订单业务。

## 核查结果

| 类型 | 后端真实对象语义 | 鸿蒙当前行为 | 准确缺口 |
| --- | --- | --- | --- |
| 动态点赞/提及 | relatedType=MOMENT，relatedId为momentId | 精确GET动态详情，模拟器已验证 | 保留 |
| 信用 | 当前账号信用概览 | 本人信用页 | 不承诺定位某条信用记录 |
| 订单 | relatedType=ORDER，relatedId为orderId；metadata可有orderId | 订单列表，未传ID | 真实GET订单、路由ID和详情落点 |
| 评价 | relatedType=REVIEW，relatedId为reviewId；metadata有orderId/reviewId | 订单列表 | 评价详情及订单关联，不能把reviewId当orderId |
| 评价申诉 | relatedType=REVIEW_COMPLAINT，relatedId为complaintId；metadata有orderId/reviewId/complaintId | 订单列表 | 评价申诉详情，不能把complaintId当orderId |
| 订单纠纷申诉 | relatedType=DISPUTE，relatedId为disputeId | 订单列表 | 纠纷详情及订单关联，须与评价申诉区分 |
| 举报处理 | ReportService.resolve未创建结果通知；GET /reports/my已有当前用户记录 | 没有举报处理通知与对应结果页 | 用户态举报记录/结果落点；自动结果通知需要后端维护者提供事件 |
| 关注 | actorUserId/sourceId/relatedId可定位用户，未提供可靠角色 | 正文展开 | 与B对齐角色解析后进入已有公开主页，不能猜CUSTOMER或PROVIDER |

来源：backend/src/main/java/com/action/camera/notification/service/NotificationService.java（resolveNavigationPath）；order/service/OrderService.java（订单通知）；review/service/ReviewService.java（buildReviewMetadata）；review/service/ReviewComplaintService.java（buildComplaintMetadata）；dispute/service/DisputeService.java（notify）；report/service/ReportService.java（resolve）。均为本仓库源码发现，不是团队确认的新接口。

## 建议接口与边界

1. 公共network/ApiService.ets：沿用唯一HttpClient、认证与ErrorMapper，新增getOrder(id:number,requestKey?:string):Promise<OrderSummary> → GET /orders/{id}；getReview(id,key?):Promise<ReviewDetail> → GET /reviews/{id}；getReviewComplaint(id,key?):Promise<ReviewComplaintDetail> → GET /reviews/complaints/{id}；getDispute(id,key?):Promise<DisputeDetail> → GET /disputes/{id}。提供cancelNotificationTargetRequests(keys:string[])，只取消传入实例key。所有方法先校验正安全整数，不能导入尚不存在的方法。
2. 公共model/ApiModels.ets：DTO严格对应ReviewResponse、ReviewComplaintResponse、DisputeResponse、OrderResponse；现ReportSummary补可选resolution/adminComment，不导入ADMIN接口。举报结果仍用既有listMyReports(key)，只在本人响应里按reportId查找；后端没有GET /reports/{id}，不能虚构。
3. C新features/notifications/NotificationTargetResolver.ets：以显式typed ID及metadata对象识别order/review/reviewComplaint/dispute/report/moment/credit。不执行任意navigationPath、不把申诉ID当订单ID；损坏JSON、缺ID、超安全整数、外域URL、类型冲突拒绝生成精确目标。Web /orders?orderId=...&section=reviews仅作为受控解析参考，不直接执行URL。
4. 公共model/NavigationModels.ets、navigation/NavigationPolicy.ets、pages/Index.ets：建议新增受保护NOTIFICATION_TARGET路由及targetKind/targetId/orderId可选参数，正常登录返回保留全部目标字段。新C只读详情destination复用真实Navigation/UIObserver/应用前后台与当前Session；不修改D完整订单流程，也不把列表展开文字当完整业务详情。
5. C pages/NotificationPage.ets增加可选onOpenTarget(target)；D pages/MessagePage.ets只透传可选回调，缺省保持旧调用。Index铃铛与消息入口共用同一解析器。B公开主页跳转继续现有userId+role契约，需B明确可靠角色来源。
6. C详情页/控制器：currentSession与实例key、逻辑session version、generation保护success/catch/finally；隐藏清旧内容，恢复重新读取；登录、403无权、404已删除分别显示真实状态。不新增评价/申诉/裁定等写操作。服务端返回对象ID须与请求一致，order关联须核对；不从通知正文构造假详情。
7. 举报结果自动通知依赖后端维护者：目标backend/src/main/java/com/action/camera/report/service/ReportService.java的resolve事务，在合法裁定成功时仅向reporterId创建REPORT_RESOLVED、relatedType=REPORT、relatedId=reportId，metadata含reportId及目标类型/ID，dedupeKey=report:resolved:{id}。同一已处理举报不二次resolve；需维护者明确事务/去重/异常语义及通知正文允许公开的处理信息。当前未提供该事件，C不能本地伪造通知或轮询冒充推送。

现有API来源：backend/src/main/java/com/action/camera/{order,review,dispute,report}/controller。用户态读取遵守服务端参与者/本人权限；管理员后台仍使用既有Web，绝不把ADMIN裁定接口接进鸿蒙。

## 行为和模拟器验收要求

- 每一类型分别用不相同orderId/reviewId/complaintId/disputeId/reportId，确认目标精确而非碰巧同值；从大厅铃铛和消息标签两条路径进入。
- 正常登录返回仍为同一对象；A账号加载中切B、退出、系统Home/恢复，旧success/catch/finally不得显示旧私有内容；两实例取消互不干扰。
- 评价被隐藏后的合法本人读取、无权他人403、删除404、非法/缺失ID、metadata损坏和ID冲突均有行为回归；不能回退到其他对象假装成功。
- 真实普通用户流程生成订单/评价/评价申诉/纠纷通知后模拟器点击核对对象；测试场景不得真实支付或擅自改已存账号、权限。
- 举报结果通知只有后端事件就绪后才能做：普通本地举报→既有Web合法处理→同reportId通知→鸿蒙本人结果页；没有该通知时标未验证，不能重复resolve制造证据。
- Node解析/控制器测试只证明处理逻辑，不替代实际导航截图。按用户最新要求本轮设备范围为官方鸿蒙模拟器；不要求实体设备。

当前结论：上述业务可以实现精确跳转，当前086a752尚未实现。已接入真实通知/已读/动态详情与本人信用，不能据此宣称订单、评价、申诉、举报的完整深链完成。
