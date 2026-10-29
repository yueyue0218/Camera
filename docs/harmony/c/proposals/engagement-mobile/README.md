# 原Web风格手机弹窗：200字授权包已接入并验收

2026-10-29，基线31986688d74833dd5b64a09fca24bb7fd18cd899，C独立分支feature/harmony-c-ui-polish，[Draft PR25](https://github.com/yueyue0218/Camera/pull/25)，唯一base integration/harmony-v1。用户明确要求评价、举报、申诉、追评等按原Web UI迁移，并强调手机适配；最终明确正文最多200字，替代先前500/1000/2000的候选上限。

## 可审阅产物与当前状态

用户已明确确认公共/B/D维护者授权，正式20文件已应用并安装。保留[逐文件与SHA](manifest.json)、[相对3198668的最终已应用补丁](mobile-dialog-integration.patch)。正式216/216，0fail/skip/TODO；assembleHap exit0、1分9.971秒，最终SHA96853387CA72C675BB6A2B6158022A08191ACA807294BF4973C466C0AC9AF5F2。独立共享举报26/26。[真实模拟器证据与范围](../../evidence/20261029-engagement/README.md)。213候选结果仅保留历史，不能替代正式结果。

## 原Web对应与手机设计

- frontend/src/pages/orders/OrdersPage.jsx的“评价与申诉”“评价本次合作”“追加追评”“发起评价申诉”；components/reports/ReportDialog.jsx的5个举报原因单选、补充说明、取消/提交。标题、说明、评分、原因和按钮语义沿用原界面；不迁移Web的本地保存假成功回退。
- 原生sheet统一米白/深蓝/浅蓝提示、底部操作条；内容区可滚动，44–48vp触达，20vp水平留白，底部28vp，SheetKeyboardAvoidMode.RESIZE_ONLY；输入区随键盘缩小后仍可滚动。小屏/长文/大字体需要实际模拟器验证，编译不算设备证据。
- 评价、追评、评价申诉说明、订单申诉、申诉回复、举报补充说明均最多200字。输入框maxLength、实时剩余字数与提交校验一致；200/201边界先RED再GREEN。举报原因仅选择现有Web固定列表，保留旧API可接受的原因契约。
- 评价/追评/评价申诉/订单申诉/回复共用一个表单呈现容器和一个有类型的控制器；举报只增加无请求逻辑的ReportDialogBody，所有提交继续由唯一B ReportPanel和原ReportSubmissionStore负责。
- 脏表单关闭确认，换目标/账号清理，连点防重，实例key隔离，旧success/catch/finally失效。未知写入保留进程内未决状态，先GET核实，不把同样历史追评正文认成本次成功；没有跨进程后端幂等保证。

## 新增边界逐项

| 文件（均为harmony/entry/src/main/ets下） | 建议变更与兼容 |
| --- | --- |
| model/ApiModels.ets | 增加OrderEngagementSummary extends OrderSummary、Review/ReviewComplaint/Dispute及payload DTO，严格对应现后端；不改旧字段 |
| network/ApiService.ets | 7个GET、5个POST及按传入key取消；只用既有认证HttpClient，旧方法/缺省key保持 |
| model/NavigationModels.ets | 新受保护ORDER_ENGAGEMENT及可选targetKind/targetId/orderId |
| navigation/NavigationPolicy.ets | 新路由认证及正常登录回传保留精确目标 |
| pages/Index.ets | 大厅铃铛/消息通知共用精确目标，订单可选详情入口；其他目标不变 |
| D pages/MessagePage.ets | 可选onOpenTarget透传，旧调用兼容 |
| D pages/OrderPage.ets | 可选reloadEpoch/真实onShown刷新与onOpenEngagement(id)，有回调进入真实本次约拍上下文，未提供回调保留原卡片展开 |
| B features/user/ReportPanel.ets | 共用原提交/核实/取消逻辑，改原Web原因单选弹窗、200字补充说明、关闭清草稿；原未知结果store保留 |
| B features/user/ReportDialogBody.ets（新增） | 纯呈现组件，无网络/认证/提交store，不能作为第二套举报实现 |

ApiService签名：getOrder(id,key?)、listOrderReviews(orderId,key?)、getReview(reviewId,key?)、listReviewComplaints(reviewId,key?)、getReviewComplaint(complaintId,key?)、listOrderDisputes(orderId,key?)、getDispute(disputeId,key?)；createReview(orderId,{rating,content},key?)、followUpReview(reviewId,{content},key?)、createReviewComplaint(reviewId,{reason,evidenceFileIds},key?)、createDispute(orderId,{reason},key?)、replyDispute(disputeId,{content},key?)、cancelEngagementRequests(keys)。先校验正安全整数；不导入不存在的方法。

实际路径：GET /orders/{id}、/orders/{id}/reviews、/reviews/{id}、/reviews/{id}/complaints、/reviews/complaints/{id}、/orders/{id}/disputes、/disputes/{id}；POST /orders/{id}/reviews、/reviews/{id}/follow-up、/reviews/{id}/complaints、/orders/{id}/disputes、/disputes/{id}/replies。均已在现后端controller核对。未接任何ADMIN接口，未修改Web/后端源码、认证/TLS/主题或共享配置。

## 精确目标和审查修复

订单、评价、评价申诉、订单纠纷分别按orderId/reviewId/complaintId/disputeId读取，损坏metadata、非法ID、类型冲突、外域navigationPath拒绝执行。通知目标记录在弹窗顶部，原评价隐藏后仍保留当前当事人可查看的裁定。回复入口和提交均只允许非发起人在OPEN状态回复，服务端最终授权保留。

四项失败回归后修复：错误回复权限、隐藏评价后投诉丢失、旧请求删除新pending、核实中关闭旧表单复活/加载不结束。正式旧185项未删除，举报原边界测试仅随明确200字需求更新补充说明长度用例；不弱化旧响应/并发/权限校验。

举报处理结果自动通知仍未由后端提供；本候选没有伪造该事件，也没有新增鸿蒙管理员页面。授权范围不包含后端举报通知新增。

## 已应用校验与验收边界

当前工作区已经应用，仅反向检查，不要重复应用：

```powershell
git apply --reverse --check --unidiff-zero docs/harmony/c/proposals/engagement-mobile/mobile-dialog-integration.patch
```

本轮授权后的应用、216项正式回归、构建、原生提交/回复、200字与键盘/取消/超时核实和typed通知目标已分别记录于上述证据。真实NavDestination.onShown刷新D保留列表；ReportPanel取消先invalidate再clearForm并restoreSubmission，不丢未知写入屏障。其他尺寸/大字体、外部部署及发布签名未验证；设备范围按用户最新要求为模拟器。
