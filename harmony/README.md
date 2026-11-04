# Portra HarmonyOS 客户端

本目录是 Portra 在现有仓库中的原生 HarmonyOS 客户端。它不会复制或重写 `frontend/`、`backend/`，而是通过 HTTP 访问现有 Spring Boot 服务。

## 当前范围

- ArkTS/ArkUI Stage 工程，目标 SDK 26.0.0。
- App Shell 和原生 Navigation 已建立，包含登录、大厅、需求与橱窗详情、发布、会话列表与详情、订单、个人中心入口。
- 大厅第一批原生 ArkUI 已按交互原型拆分为品牌栏、频道切换、筛选、发布 Banner、双列橱窗卡和底部导航；没有使用 WebView。
- 网络底座已建立：`HttpClient`、`ApiService`、公开读取、约拍写请求、原生会话刷新/退出、错误映射、Bearer Token 注入、请求取消和旧响应保护。
- B 的手机号与 Session 契约已冻结并合入 `main`。客户端已接入短信发送、原生验证码登录、Refresh/Logout 和当前会话读取；Access Token 只保存在内存，Refresh Token 使用 HarmonyOS Asset Store 按环境保存。安装标识由本机随机生成并持久化，不读取硬件标识。
- 视觉组件目前是临时基础设施，不代表舍友正在设计的最终 UI。

大厅具备真实列表 UI；Login 有手机号验证码表单，Profile 展示真实会话信息并支持退出。需求发布、摄影师响应、客户接受、会话文字消息、摄影师报价和客户确认报价已接现有后端；橱窗详情与客户咨询也已接线。订单页仍是只读列表，通知、图片上传、图片消息展示、交付和评价等未纳入本次闭环。鸿蒙端没有新增支付入口；后端旧订单模型仍保留 `PENDING_PAYMENT` 与模拟支付代码，不能据此宣称支付业务已完成或已移除。

本轮的最小闭环需要两个不同角色账号人工验证：客户登录并发布需求，摄影师登录后在需求详情发送响应，客户接受并进入会话，摄影师在会话中发送文字及拍摄约定，客户确认后两端都能看到“双方约定已确认”。再次确认同一报价应返回同一订单。未在真机/模拟器和可收短信的环境完成这项人工验收前，只能称为“代码接线和构建通过”，不能称为“上线闭环已验证”。

## 构建

在 DevEco Studio 中打开本目录，选择 API 26.0.0 后执行 Build。

命令行构建需要把 DevEco Studio 自带的 Node、Hvigor 和 SDK 加入当前终端环境。路径使用本机实际安装位置，不要提交个人绝对路径：

```powershell
$env:NODE_HOME = '<DevEcoStudio>/tools/node'
$env:DEVECO_SDK_HOME = '<DevEcoStudio>/sdk'
$env:PATH = "$env:NODE_HOME;<DevEcoStudio>/tools/hvigor/bin;<DevEcoStudio>/tools/ohpm/bin;" + $env:PATH
<DevEcoStudio>/tools/hvigor/bin/hvigorw.bat assembleHap --no-daemon
```

AGC 已注册 Portra HarmonyOS 应用，正式 bundleName 为 `com.portra.app`。当前构建仍只能生成未签名 HAP；调试签名和设备安装尚未完成，因此暂不能宣称已安装运行。

## 环境和接口状态

工程提供 `dev`、`staging`、`production` 三个 Build Product，`default` 是 `dev` 的别名。`hvigorfile.ts` 根据当前 Product 同时注入 `PORTRA_ENVIRONMENT` 和 `PORTRA_BASE_URL`，再由生成的 `entry/BuildProfile` → `BuildEnvironment` → `EnvironmentConfig.current()/isUsable()` → `HttpClient` 读取。地址优先级为：非空进程变量 `PORTRA_BASE_URL` → 本地文件所选环境的非空地址 → 所选 Product 的 Build Profile 字段。插件不会再用缺失的变量覆盖已有字段。

### DevEco Studio 普通 Run/Debug（推荐本地文件）

1. 用 **File → Open** 打开仓库下的 **harmony 文件夹**，不要打开仓库根目录或仅打开 `entry`。目标 SDK 为 26.0.0。
2. 在工程根目录复制 `portra-environments.example.json` 为 `portra-environments.local.json`（如已有则直接编辑，不要覆盖）。填写所选环境的 origin；这是标准 JSON，不支持注释。文件已加入 `.gitignore`，不得提交；只保存地址，不保存 Token、密码或签名材料。
3. 在 **View → Tool Windows → Build Variants** 的 Product 选择器选择 `dev`、`staging` 或 `production`，核对 entry Target 同名；`default` 对应 dev。Build Mode 选 `debug`。不同 IDE 版本如移动了面板，可用 **Find Action** 搜索 `Build Variants`。Product 决定环境，Run/Debug 的启动参数不决定环境。
4. 修改配置后执行工程 Sync，再由你手动 Run/Debug 到支持真实网络的模拟器或真机。进程环境变量有更高优先级，如提示 override target 不匹配，清除旧变量或同时更新环境名称。Hvigor daemon 可能保留旧进程变量；切换进程变量后需停止旧 daemon 并重启 IDE。本地文件在插件配置时读取，不依赖另一个终端的变量。
5. 手动检查 `entry/build` 中**本次所选 Product/Target 的生成 BuildProfile**（搜索 `PORTRA_ENVIRONMENT`、`PORTRA_BASE_URL`，不要编辑生成文件）。在 `HttpClient.request()` 的 `request.request(...)` 前设断点，查看 `profile.name`、`profile.baseUrl`、`path`，确认合成地址是 origin + 原有路径。不要输出认证头或 Token。成功收取真实响应后才能判定连接成功；配置正确仍可能受设备网络、TLS 或服务端能力影响。

本次 P0-01 新建的本地文件只填写了 staging；dev、production 均为空。来源是本 README 的既有临时 staging 记录、`../infra/staging/nginx/portra-ssl.conf` 和 `../docs/deploy/C_DEPLOY_01_STAGING_CLOSURE.md`。该 HTTPS IP 是仓库明确标记的 API 入口，不是从 SSH 或数据库配置推断的；本次没有访问该地址。正式 production 域名尚未确认，`portra.example.com` 和旧 API 规范中的示例域名不可当作已部署地址。

dev 请填设备可达的开发后端 origin，允许 HTTP；不能默认填生产地址。staging 请填团队确认的测试 HTTPS origin。production 必须单独填写经确认的正式 HTTPS origin，不会继承 staging 或 dev。三种环境共用一条网络配置链，凭据仍按环境名称隔离。

### 进程变量覆盖（可选）

沿用 `PORTRA_BASE_URL`，同时要求 `PORTRA_ENVIRONMENT` 与所选 Product 一致，防止残留变量在切换 Product 时跨环境覆盖。`PORTRA_ENVIRONMENT` 只是覆盖确认值，不能代替选择 Product。普通 IDE Run/Debug 使用上述本地文件即可，无需配置环境变量输入框；在另一个终端设置变量不会影响已经启动的 IDE。需要变量方式启动 IDE 时，入口为 **Windows 设置 → 系统 → 系统信息/关于 → 高级系统设置 → 环境变量 → 用户变量 → 新建**，添加这两个变量，完全退出并重新启动 DevEco Studio；同时确保旧 Hvigor daemon 已停止。避免把临时覆盖长期保存在用户变量中。

开发设备与电脑处于同一局域网时，先用 `ipconfig` 找到电脑可达的 IPv4 地址，再执行：

```powershell
$env:PORTRA_BASE_URL = 'http://<电脑局域网IPv4>:8080'
$env:PORTRA_ENVIRONMENT = 'dev'
& "<DevEcoStudio>/tools/hvigor/bin/hvigorw.bat" assembleHap --no-daemon `
  -p product=dev
```

`PORTRA_BASE_URL` 只对当前终端进程有效，不会写入源码或 Git。`127.0.0.1` 在手机或模拟器里通常指设备自身，不能代替电脑地址。后端还必须监听局域网接口，Windows 防火墙也必须允许对应开发端口；这些条件由实际联调确认。Staging 和 Production 必须选择相应 Product，并先把该环境变量设置为团队确认的 HTTPS origin，再构建；Hvigor 和应用运行时都会拒绝这两个环境的 HTTP 地址。

系统网络策略也按 Product 对应的模块 Target 隔离：`default/dev` 构建才包含允许开发 HTTP 的配置，`staging/production` 构建均显式禁止明文流量；应用层的 `EnvironmentConfig` 还会再次拒绝非 DEV 环境的 HTTP 地址。该配置不关闭或绕过 HTTPS 证书校验。DevEco Studio 中也必须选择与目标一致的 Product。

团队当前临时 Staging 地址为 `https://47.76.106.57`。需要设备联调时，选择 staging 并使用本地文件，或在当前终端同时设置 `$env:PORTRA_ENVIRONMENT = 'staging'`、`$env:PORTRA_BASE_URL = 'https://47.76.106.57'`，再以 `-p product=staging` 构建；这只是构建配置，不代表本次已在鸿蒙设备上验证。正式 Production 地址尚未确认，不要把临时 Staging IP 固化进共享配置或 HttpClient。

### Previewer 和应用尝鲜 Release

Previewer 用于布局与视觉预览，不能用来证明真实网络可用。打开 `entry/src/main/ets/preview/HallPreviewEntry.ets`，点击编辑器 Preview 面板，选择 Portra Hall/Demands 的预览组件；演示数据仍只在 `src/ohosTest/ets/preview/HallPreview.ets`，入口未注册到正式 `main_pages.json`。不需要 API 地址。不要用真实 `HallPage` 的网络报错判断预览能力，也不要给正式运行路径加 Mock 回退。

Debug 未填地址时会打印明确的配置警告，运行时继续由 `EnvironmentConfig.isUsable()` 禁止请求；无法在缺少开发服务器地址时安全猜测默认值。Release 则在配置阶段拒绝 `default/dev` 以及空地址，staging/production 仍强制 HTTPS。应用尝鲜分发前必须人工选择获准分发的 staging 或 production 服务并配置地址、核对生成字段与设备请求；临时 staging 不自动等于获准分发环境。本次不执行构建、设备验收、签名或上传。该门槛仅检查配置，不能证明 TLS、短信或业务可用。

当前已核对的公开接口是：

- `GET /demands?page=1&size=10`
- `GET /service-packages?page=1&size=10`
- `GET /demands/{demandId}`
- `GET /conversations`（需要登录）
- `GET /orders`（需要登录）

2026-09-29 从本地对临时 Staging 只读探测，两条接口均返回 HTTP 200、业务码 200：需求列表为 0 条，摄影橱窗列表为 1 条测试数据。此前 `moderation_status` 缺列导致的错误在这两条接口上已不再出现；这不证明全库迁移或设备联调完成。大厅代码已请求真实列表，D08 仍需在鸿蒙设备上确认加载、空状态、图片回退和错误重试。

临时 Staging 的后端配置为 `temp-staging`，该运行配置当前使用 `DisabledSmsSender`，因此即使客户端登录页面已接线，也不能把收取真实短信并登录记为完成。启用团队认可的短信发送环境后再进行人工联调；不要用固定验证码或假登录绕过。

正式大厅只调用上述真实接口，并覆盖 Loading、Empty、Error 和正常列表状态。视觉对照数据仅位于 `entry/src/ohosTest/ets/preview/HallPreview.ets`；DevEco 要求 Preview 入口位于 `src/main/ets`，因此请打开不含数据且未注册到正式页面的 `entry/src/main/ets/preview/HallPreviewEntry.ets`。该入口包含镜头与约拍的 360、390、430 vp 预览，以及 Loading、Empty、Error、长中文、无头像、无图片和长价格/预算边界预览。频道切换会把内容滚动位置复位到顶部，避免较长的镜头列表把旧滚动位置带入约拍列表。默认 HAP 仍需通过示例数据泄漏检查。当前没有连接模拟器或真机，因此系统字体放大和安全区仍需在 Preview 或设备上完成最终视觉验收。

### C 模块报价与订单

会话里的报价和订单卡只展示摘要。摄影师可进入独立表单发送或编辑待确认报价；客户可在报价详情中确认或拒绝。确认后以服务端订单为准，客户的「确认支付」调用现有模拟支付接口，不会真实扣款。支付响应不明时，订单页会查询服务端结果，再提示刷新。订单列表进入独立详情，详情可返回对应会话。

打开 `entry/src/main/ets/preview/QuoteOrderPreviewEntry.ets` 可查看客户、摄影师视角的待确认报价、待支付订单、已拒绝报价、报价详情和支付确认层。静态示例仅位于 `entry/src/ohosTest/ets/preview/QuoteOrderPreview.ets`；正式 HAP 不含这些数据。Preview 可编译不代表已完成真机视觉验收。

## 提交边界

以下内容由工程忽略，不应提交：`build/`、`.hvigor/`、`oh_modules/`、`.idea/`、`local.properties` 和 HAP 构建产物。签名私钥、密码、token 和个人路径也不得提交。

## D07 网络逻辑验证

在本目录执行（沿用上面的 `DEVECO_SDK_HOME`、`NODE_HOME`）：

```powershell
& "$env:NODE_HOME/node.exe" --test tests/network.test.cjs
```

测试加载实际网络层 `.ets` 源码，使用 SDK 自带的 TypeScript 转译器和隔离的 NetworkKit 测试替身。覆盖成功/合法空值、畸形响应、HTTP 与业务错误、超时、取消、旧响应、凭据变更、公开接口、原生会话请求和地址约束。测试数据仅用于验证逻辑，不进入业务页面，不证明数据库或设备联调通过；ArkTS 兼容性另由 `assembleHap` 检查。

两条公开列表使用 `getPublic`，即使本地存在 token 也不附带认证头。其他 `get` 请求可携带 Bearer；通过 HttpClient 设置或清除 token 时会取消在途请求。所有请求禁用自动重定向与 HTTP 缓存；50001 等错误不直接展示后端 SQL 文本。超时码 2300028 依据本地 SDK 声明和[华为 HTTP 文档](https://developer.huawei.com/consumer/en/doc/harmonyos-references-V13/js-apis-http-V13)。

限制：当前主要校验统一响应包装和列表 `records` 是否为数组，尚未逐字段校验服务端列表记录；真实设备上的列表呈现仍待 D08 验收。401/40101 会清理会话；403 只表示权限不足。凭据按环境隔离，其他业务缓存仍未建立。

## D09 导航逻辑验证

导航目标统一由 `NavigationPolicy` 管理。Login、Hall、DemandDetail、ServiceDetail 是公开入口；Publish、Message、ConversationDetail、Order、Profile 在游客状态下进入 Login，并保留原目标。详情页只接受正的安全整数 ID。登录成功后返回原目标；首次安装且无有效凭据时按游客状态运行。

```powershell
& "$env:NODE_HOME/node.exe" --test tests/navigation.test.cjs
```

该测试检查路由名称、公开/认证入口、登录前目标和详情参数。快速点击由页面入口的 350 ms 保护处理，返回由 `NavPathStack.pop()` 和系统 Navigation 栈处理；设备上的物理返回键和完整交互仍在最后的安装验收中确认。

## D10 认证底座验证

`AppClient` 让导航、会话和网络层共享同一个 token 状态。登录页调用 `POST /auth/sms/send` 和 `POST /auth/native/sms/verify`；应用启动时从 Asset Store 读取当前环境的 Refresh Token，通过 `POST /auth/native/refresh` 换取新的 Access Token。Access Token 只保存在内存。暂时断网不会删除已保存的凭据，真正的 401/40101 会使在途旧请求失效。个人中心通过 `GET /auth/session` 读取昵称和身份，退出时调用 `POST /auth/native/logout` 并清理本地凭据。凭据禁止设备间同步，应用卸载后不保留，且没有保存密码或验证码。

```powershell
& "$env:NODE_HOME/node.exe" --test tests/auth.test.cjs
```

该测试使用隔离的 Asset Store 与 NetworkKit 替身，验证环境隔离、存取失败、并发恢复去重、断网后凭据保留、退出、并发过期、401/403 区分和账号切换。`tests/login.test.cjs` 另检查手机号规范化和安装标识持久化；`tests/network.test.cjs` 检查原生登录请求路径与请求体。真实设备上的 Asset Store 读写、收码登录和应用重启恢复仍待验收。认证契约见 [`docs/data/b-auth-final-contract.md`](../docs/data/b-auth-final-contract.md)。

## D11 非视觉组件行为

现有组件样式仍是临时底座，不代替正式 UI 稿。`PortraButton` 已限制快速重复触发；`PortraInput` 有禁用、焦点和错误状态；`PortraAvatar`、`PortraImage` 对空头像和加载失败提供稳定回退。字符串图片源只允许公开 HTTPS 地址，本地图片使用打包的 `Resource`；需要认证的私有文件不得把 Bearer token 拼进图片 URL，后续由独立下载层处理。

```powershell
& "$env:NODE_HOME/node.exe" --test tests/components.test.cjs
```

组件策略可以在电脑上测试；实际图片解码、键盘遮挡、放大字体和小屏布局仍需模拟器或真机验收，并等待最终 UI 稿确定视觉参数。
