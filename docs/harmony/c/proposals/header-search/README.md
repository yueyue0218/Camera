# 大厅右上角搜索与通知：已授权应用

基线7a09a48，保持原C独立分支和Draft PR25、base integration/harmony-v1。用户已明确确认公共维护者授权，唯一公共文件features/shell/PortraAppShell.ets已应用；[精确差异](shell-search.patch)、[7文件SHA清单](manifest.json)。现有铃铛仍指向NOTIFICATIONS，搜索占位改为C原生sheet。

搜索严格按服务端currentSession返回的当前身份：**PROVIDER仅需求；CUSTOMER仅摄影橱窗**。没有镜头/约拍分类或手动范围切换。游客先走既有正常登录，未知身份不猜范围。开页、每次查询/分页、前台恢复核对身份；切账号/角色、后台/隐藏/关闭清旧词和结果，旧success/catch/finally失效，结果点击也按身份和会话版本校验。

沿用既有ApiService.currentSession(key?)、listDemandsByQuery(query,key?)、listServicePackagesByQuery(query,key?)及精确取消；纯名义委托，无第二网络/认证层。复用现有HallCards与既有详情路由。Shell仅提供搜索sheet、root/HALL可见性和既有登录/详情回调，不改公共导航/DTO/网络/认证、A/B/D页面或主题。其余6个文件是C控制器/委托/呈现和3份回归。

正式234/234、0fail/skip/TODO，assembleHap exit0/19.151秒；HAP SHA256 A37689A36A8C15C0B3A17EF177D85A9830AC106D70E478251CCBEAB7FD6A333C，已安装官方API26模拟器。18项相关独立复核通过，无剩余确定P1/P2。仅本地H2，完整[截图、真实角色切换及命令](../../evidence/20261029-header-search/README.md)。当前仅反向校验，不要重复应用：git apply --reverse --check --unidiff-zero docs/harmony/c/proposals/header-search/shell-search.patch。
