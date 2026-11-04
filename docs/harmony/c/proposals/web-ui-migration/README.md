# Web UI迁移：已授权应用的通知/信用接入

2026-10-28，用户已明确确认公共、B、D维护者授权，正式应用并完成本地原生验收。基线c37eb7a。[最终整包补丁](notification-credit-integration.patch)含9个获授权文件、6个C新源、5个测试；[逐文件原始候选及实际摘要](manifest.json)标明已应用/安装。

9个边界文件为network/HttpClient.ets（新增PATCH）、model/ApiModels.ets（通知/信用DTO）、network/ApiService.ets（通知/信用方法与currentSession可选key）、model/NavigationModels.ets、navigation/NavigationPolicy.ets、pages/Index.ets、features/shell/PortraAppShell.ets、D pages/MessagePage.ets、B pages/ProfilePage.ets。原认证/TLS/超时、共享主题、A页面、Web与后端源码/共享配置未变。

API精确签名：listNotifications(page=0,size=20,key?)、unreadNotificationCount(key?)、markNotificationRead(id,key?)、markAllNotificationsRead(key?)、cancelNotificationRequests(keys)；getCreditSummary(id,key?)、listCreditRecords(id,key?)、cancelCreditRequests(keys)。currentSession/cancelCurrentSession缺省仍auth.session，旧调用兼容；PATCH原生走既有HttpClient.request，不用POST冒充。C ActivityApiBindings只做ArkTS名义类型委托，无HTTP或凭据逻辑。

通知页、本人信用页、通知动态详情均原生，复用真实导航/前后台事件和现有互动组件。未知已读结果不假成功、按实例取消；新用户合法null分数显示暂无，真实0保留。登录返回momentId和旧通知相关入口检查、跨页共享互动屏障已补失败回归并修复。分类计数标明只针对已加载数据，不复制Web未分页的假全量语义。

正式全套185/185，0TODO；独立相关36/36；最终assembleHap exit0、18.149秒。真实普通点赞/关注生成两条通知，原生单条2→1、全部已读0、进入真实动态、Home恢复、个人信用80/空记录/说明、切角色后重新读取均有[设备和只读对照证据](../../evidence/20261028-web-ui/README.md)。

已应用工作区请反向校验，不要重复应用：

```powershell
git apply --reverse --check --unidiff-zero docs/harmony/c/proposals/web-ui-migration/notification-credit-integration.patch
```

实体设备按用户要求不列本轮条件；外部团队环境、发布签名/升级仍未验收；PR25保持Draft，base integration/harmony-v1，不自动合并。完整[交付记录](../../c-module-delivery.md)。
