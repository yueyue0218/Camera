# 手机端评价、追评、申诉与举报弹窗迁移

> 执行：executing-plans；同一会话按任务执行，保留原C独立分支和Draft PR25。

目标：按现有Web OrdersPage/ReportDialog迁移原生弹窗，手机尺寸、键盘和大字体下可操作；复用真实API、身份和举报可靠性。

设计：评价/追评/评价申诉/订单申诉及回复使用一个原生表单容器和一个有明确类型的提交控制器；评价与申诉记录在对应订单上下文内读取。举报继续唯一B ReportPanel，仅改Web单选原因与弹窗呈现，保留原提交store、实例key及未知结果核实。所有写操作服务器确认，网络不明冻结重发并先GET核实；不迁移Web本地假成功回退。精确通知目标解析不把review/complaint/dispute ID当order ID。

授权边界：C新代码和候选准备已授权；新增公共网络/DTO/导航与B共享举报、D订单/消息接线先在scratch候选验证，形成逐文件补丁，按原用户要求取得对应维护者明确授权后才能正式应用。此计划不是公共授权。

- [x] Task1 tests/engagement-behavior.test.cjs与notification-target.test.cjs：先RED，验证表单校验/清理、旧success/catch/finally、提交序列、未知结果、跨实例取消、typed ID解析；新增features/engagement/EngagementController.ets（模型同置控制器）、notifications/NotificationTargetResolver.ets。
- [x] Task2 features/engagement/EngagementDialogs.ets：原Web标题/文案/星级/原因列表/正文/确认丢弃；单原生sheet容器、可滚内容、底部安全区、输入长度、最小44vp触达，折行无固定宽度。
- [x] Task3 pages/OrderEngagementPage.ets：真实订单/评价/评价申诉/纠纷记录上下文，当前会话与真实页面显露/隐藏/前后台隔离；表单权限基于服务端上下文，403/404显示真实错误。
- [x] Task4 候选network/ApiService、model/ApiModels与NavigationModels、NavigationPolicy、Index、D OrderPage/MessagePage，B ReportPanel最小接线；旧回调可选保持兼容；生成精确补丁/签名/范围。
- [x] Task5 候选相关和全套回归、assembleHap、末尾独立审查；授权后正式应用重跑并在官方模拟器正常普通流程验收，截图记录手机键盘/长正文/关闭/切对象/身份及真实提交；没有授权不安装冒充正式验收。

手机验收：官方API26手机模拟器，至少既有1280x2832/560dpi下键盘、长正文、大字体；小屏条件用可用官方配置，不修改系统安全/隐私。真实截图与源码布局检查分别记录，未操作的屏幕尺寸不称已验证。

正式执行结果：本轮9文件已获对应维护者授权，216/216、assembleHap exit0、官方模拟器真实提交及举报核实通过；其他尺寸/大字体未实测，完整证据与不同包/环境来源见 evidence/20261029-engagement/README.md。
