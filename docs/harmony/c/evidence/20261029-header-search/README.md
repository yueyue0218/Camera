# 大厅按身份搜索与铃铛通知：真实模拟器验收

2026-10-29（北京时间），官方Portra_C_API26/HarmonyOS7.0.0.107/API26，1280×2832/560dpi。最终按用户纠正执行：摄影师只搜索需求，客户只搜索摄影橱窗，没有搜索分类按钮。

## 环境与安全范围

构建进程PORTRA_BASE_URL=http://127.0.0.1:18090，hdc Reverse tcp:18090→tcp:18090。来源为既有授权smoke/H2 portra_c_engagement_recovery_20261029；原生及正常HTTP均实际连通。这是授权隔离本地环境，不是团队确认的staging。复用已获准的普通双角色用户1，正常随机短信登录；需求1由普通用户3正常POST创建，标记CSearch20261029，仅此本地对象。没有新管理员、验证码绕过、改账号绑定/密码、真实资金、SQL造状态或共享配置变更。[安全查询准备数据](search-data.json)只含合成内容和ID。

最终正式unsigned HAP SHA256 **A37689A36A8C15C0B3A17EF177D85A9830AC106D70E478251CCBEAB7FD6A333C**，以下截图均来自该包；包、日志、凭据和验证码不提交。来源是C独立工作区正式源码，无诊断或候选网络层。

## 真实操作与证据

| 原生行为 | 实际结果 |
| --- | --- |
| 大厅搜索图标 | [游客状态](guest.png)：显示“登录后按当前身份搜索”，没有默认搜索两类数据；正常既有登录入口可用 |
| 摄影师身份 | 普通用户1正常短信登录为PROVIDER，[搜索](provider.png)只显示需求；20261029真实命中唯一需求1，不出现橱窗；无分类按钮 |
| 需求结果 | [详情](demand-detail.png)真实读取需求1的CSearch20261029正文；搜索先关闭，返回大厅后重开为空 |
| 正常身份切换 | 个人页点击“切换到约拍用户”，服务端确认并通知既有SessionManager；[切为CUSTOMER](switch-customer.png)，没有直接改角色绑定 |
| 客户身份 | [搜索](customer.png)只显示6条真实摄影橱窗，20261029不再展示需求；同一用户/不同当前角色，无分类按钮 |
| 橱窗结果 | [详情](service-detail.png)真实进入serviceId6，标题C手机弹窗验收20261029-6；搜索关闭后正常返回 |
| 无结果 | [CNoMatch20261029_9f0d](no-results.png)真实总数0，明确空态，不放推荐假结果 |
| 手机键盘 | [实际键盘](keyboard.png)：输入和搜索按钮可达，内容区按RESIZE_ONLY收缩滚动；仅验证当前手机尺寸 |
| 真实Home→恢复 | 实际观察launcher后aa start回应用，[旧查询及结果清除](foreground.png)，重新核对当前CUSTOMER身份；不是Node手动调用生命周期 |
| 大厅铃铛 | [通知页](notifications.png)：原大厅右上角ic_bell进入现有真实通知，不是消息列表占位；当前有效普通会话正常加载 |

同名.md为官方Emulator实际UI树。树中保留背景大厅自身原有“镜头/约拍”标签，**搜索弹层自身没有分类**；断言与截图均核对当前搜索表面，不把底层Hall标签当搜索分类。

## 命令和结果

| 实际命令/检查 | 退出码与结果 |
| --- | --- |
| node --test --test-name-pattern='photographer identity\|search UI has no' tests/hall-search-behavior.test.cjs（修正前） | 1；旧实现错误搜索services及存在分类，两项RED |
| node --test tests/hall-search-observer.test.cjs（保护前） | 1；监听失败后仍resume=1，随后修复为只能关闭重开 |
| PowerShell展开tests/*.test.cjs后DevEco node --test | 0，**234/234**，0fail/skip/TODO，4.947秒 |
| 独立复核三份搜索测试 | 0，18/18；身份版本、旧响应、实例取消、失败恢复、入口行为 |
| harmony目录；PORTRA_BASE_URL=http://127.0.0.1:18090；hvigorw.bat assembleHap --no-daemon -p product=dev | 0，**19.151秒**，33tasks（17执行16up-to-date） |
| hdc install -r entry-dev-unsigned.hap；aa start | 0/0；实际安装启动及后续两角色搜索验收 |
| git apply --reverse --check --unidiff-zero 最终Shell补丁 | 0；唯一公共边界已应用 |

编译曾exit1/17.751秒，定位到旧channel属性残留，结果分支已改role==='CUSTOMER'后再通过；该失败不冒称通过。早期采集脚本仍只匹配“搜索”标题，角色标题变“搜索需求”后断言失败，重新读取实际UI并修正采集器；另一次预期客户时实际是过期游客，按真实提示正常短信登录，未绕过身份或把游客算通过。旧可切范围原型及225测试/旧截图不是本轮最终交付。

## 实现与边界

搜索依赖现有认证currentSession确定role，再调用当前身份唯一对应的既有公开关键词列表接口；session和列表key都按实例隔离，关闭不会取消大厅默认请求。词变更、账号版本变化、后台/隐藏/关闭都使旧响应/异常/finally失效；canOpen还校验当前身份、会话及结果ID。真实root/HALL可见性由原Shell提供，C复用既有MomentFeedLifecycle订阅；监听失败后只允许关闭重开，不能借身份重试恢复无监听的搜索。

没有新公共路由、DTO、网络/认证能力或A/B/D页面变更。原搜索结果使用现有卡片，缺图使用既有真实无图态；没有补假图片或搜索历史。关键词最大100字，与评价等200字正文限制分别适用。未实测其他尺寸/大字体；HAP未配置发布签名。本轮仅按用户要求使用模拟器，之前C发布外部环境和举报结果通知依赖保持原交接，PR25继续Draft，不合并。
