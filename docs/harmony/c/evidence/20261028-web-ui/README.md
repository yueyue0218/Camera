# Web风格迁移：真实鸿蒙通知、信用与动态

2026-10-28，用户明确要求按Web风格迁移并接入通知；随后明确确认公共、B、D维护者授权9个公共/所属页面文件。正式基线c37eb7a，分支feature/harmony-c-ui-polish；[PR25](https://github.com/yueyue0218/Camera/pull/25)保持Draft，唯一base integration/harmony-v1。

## 来源、环境和产物

视觉来源为现有Web NotificationListPage.jsx、CreditDetailPage.jsx/credit.css及Feed样式：米白纸面、深蓝强调、浅蓝未读卡、黄色用户标签、信用圆章。实现为原生ArkUI，不是WebView截图或新Web页面。迁移的是通知分类/全文展开/已读、本人信用概览/记录及评分说明；没有承诺全部Web业务页面、动态通知聚合折叠、系统推送或他人私有信用历史。

仅使用既有用户授权隔离H2 portra_c_final_20261028，回环http://127.0.0.1:18090，实际Connected设备18090→本机18090反向转发。普通actor1原本双角色，正常随机短信登录；普通用户2正常点赞和关注产生真实通知，未直写通知表。新moment3“秋日光影 · 鸿蒙 UI 验收”，图片复用仓库现有frontend/src/assets/film-autumn.png，只写此本地专用对象。没有新管理员、密码重置、固定验证码、token注入、后端源码或共享配置变更。

最终包为harmony dev unsigned，SHA256 **5B111863BB9ED0A573F97C245C33E3AD716C2B3B26596828E50F9E10EA7EE318**。官方Portra_C_API26，HarmonyOS7.0.0.107/API26。最终feed/notifications/credit三页截图来自此包。其余逐步行为截图来自25E731B37E822BE471F2AE93B882ED866A1602188A4C7BC818FE3CE1F0CE0CC8包；两包仅通知和信用返回按钮padding(0)有差异，控制器、网络与路由相同。早期7F788C包发现嵌套消息标题和短列表居中，已修正并重新构建/覆盖安装，未拿初次截图冒充最终效果。这里不是staging/实体签名验收，Web样式来源不等于本轮已做同库Web通知账号联调。

## 恢复运行与最终截图来源

收尾时实际核查模拟器和原内存后端均已退出，原证据保持。通过官方Emulator重新启动同一Portra_C_API26（无reset），新回环H2进程使用同一已授权普通双角色夹具。首次Java17因默认Unix域回环失败；复用已验证的仅进程IPv4和工作区jdk-tmp参数后成功。普通用户正常短信/动态/点赞/关注重建了moment1、通知1/2；[恢复前快照](recovery-before.json)、[恢复后普通只读核对](recovery-after.json)与原moment3/通知2、3分开记录。模拟器短信首次返回40001，冷却后正常成功，没有绕过频率限制或验证码。最终feed/notifications/credit三页来自恢复运行；通知截图拍在2未读时，随后[单条1](recovery-one-read.png)、[全部0](recovery-all-read.png)、[确切动态1跳转](recovery-related-moment.png)均在最终5B111包再次实测。每张有同名UI树；两个返回箭头正常显示且可返回。

## 原生操作和证据

| 操作 | 结果及截图 |
| --- | --- |
| 最终动态页 | [动态](feed.png) / [UI](feed.md)，恢复运行真实moment1及仓库配图，保留筛选、收藏、点赞、详情、作者、举报原有行为 |
| 最终包通知页 | [当前通知](notifications.png) / [UI](notifications.md)，恢复运行2条未读来自正常重新请求，之后真实2→1→0另见恢复证据 |
| 大厅铃铛→通知 | [未读2](notifications-unread.png) / [UI](notifications-unread.md)，真实通知3=FOLLOWED、2=MOMENT_LIKED/动态3；[只读初始快照](before.json) |
| 点赞通知点击即读 | [未读2→1](notification-one-read.png)，原生PATCH /notifications/2/read后重新GET，非乐观改布尔 |
| 查看相关内容 | [真实动态3详情](notification-moment-detail.png)，完整1/1来自GET，沿用MomentInteractions及共享互动屏障 |
| 返回→全部已读 | [未读0且两条已读](notifications-all-read.png)，原生PATCH /notifications/read-all后GET核实 |
| 通知→实际系统Home→恢复 | [前台状态正确](notifications-foreground.png)，系统launcher已实际观察；Node不算此路径证据 |
| 个人页正常信用入口 | [本人信用概览](credit.png) / [UI](credit.md)，真实80.0/待积累/用户1，缺失好评率和违约率为--，未捏造0% |
| 信用评分说明 | [展开](credit-rules.png)，正常按钮展开/收起 |
| 本人分数变化 | [空记录](credit-records.png)，后端真实recordCount0，不填示例记录 |
| 信用实际Home→恢复 | [前台仍为当前真实概览](credit-foreground.png) |
| 我的→成功切PROVIDER到CUSTOMER→再入信用 | [普通角色切换](role-customer.png)、[当前用户1信用](credit-after-role.png)，旧页已销毁/失效，按当前会话读取 |
| 消息→通知标签 | [最终入口](message-notifications.png)，没有旧占位或双层标题；[未读分类空态](notifications-unread-empty.png) |
| 独立普通只读观察器 | [after.json](after.json)：正常短信登录后GET，unread0，通知2/3均isRead=true，信用80、记录0；他人私有信用记录40301。观察器不执行已读PATCH，不替代原生写操作 |

上述每张原生截图有同名.md UI树；不含登录验证码、token、原始系统日志或安装包。已有动态/举报完整证据继续保留：[前次本地验收](../20261028-final/README.md)、[点赞详情](../20261028-like-detail/README.md)。

## 回归、构建与限制

2026-10-29收尾重跑：首条命令遗漏进程DEVECO_SDK_HOME，测试加载阶段exit1；补设既有SDK路径后，同一全套exit0、185/185、0fail/skip/TODO，4.533秒，没有修改源码或放宽测试。最终交付仍使用已实际安装的18.149秒构建包。

正式harmony目录：DEVECO_SDK_HOME为本机现有SDK；PowerShell显式展开tests/*.test.cjs后node --test：**exit0，185/185，0fail/skip/TODO**。原162项未弱化；新增23项包括真实HttpClient PATCH/分页/key隔离、旧success/catch/finally、tap前身份变化、可空信用分、登录返回momentId及共享互动屏障。旧API严格5失败、四处审查边界问题先RED后GREEN；独立相关36/36。

PORTRA_BASE_URL=http://127.0.0.1:18090，hvigorw.bat assembleHap --no-daemon -p product=dev：最终**exit0、18.149秒，33tasks（17执行16up-to-date）**。hdc install -r、aa start均0。首次候选ArkTS exit1（constructor属性/名义类型/static this）已修；候选最终185/185、17.375秒构建成功，授权后正式重跑。普通数据生成及只读观察器均exit0。第一次原生登录操作因IME截获未发短信，实查无新回执后正常请求一次；一次共享日志读取锁冲突改Get-Content成功；Profile语义点击错误自动滚动，改按实际可见范围用官方hdc点击进入，均未伪记成功。

通知零基分页，分类计数只针对已加载条目，明确已加载/总数；全局未读来自真实count。当前默认手动刷新/重新进入及前台恢复，不轮询、不承诺系统推送或实时角标。已读超时仅提示刷新核实；所有传输仍为唯一认证HttpClient。支持已有原生动态详情/信用/订单列表相关目标，其余通知可读正文，不执行后端navigationPath任意URL。信用只展示本人记录，非本人私有历史不会请求。

仍未验证团队外部原生短信环境/部署SHA/合法后台、签名升级；实体设备按用户最新要求不列本轮条件；本地H2普通夹具结果单独记录，不称完整发布验收完成。
