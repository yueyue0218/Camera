# Portra HarmonyOS 客户端

本目录是 Portra 在现有仓库中的原生 HarmonyOS 客户端。它不会复制或重写 `frontend/`、`backend/`，而是通过 HTTP 访问现有 Spring Boot 服务。

## 当前范围

- ArkTS/ArkUI Stage 工程，目标 SDK 26.0.0。
- App Shell 和原生 Navigation 已建立，包含 Login、Hall、DemandDetail、Publish、Message、Order、Profile 入口。
- 大厅第一批原生 ArkUI 已按交互原型拆分为品牌栏、频道切换、筛选、发布 Banner、双列橱窗卡和底部导航；没有使用 WebView。
- 网络底座已建立：`HttpClient`、`ApiService`、公开列表 GET、原生会话刷新/退出 POST、错误映射、Bearer Token 注入、请求取消和旧响应保护。
- B 的手机号与 Session 契约已冻结并合入 `main`。客户端已接入短信发送、原生验证码登录、Refresh/Logout 和当前会话读取；Access Token 只保存在内存，Refresh Token 使用 HarmonyOS Asset Store 按环境保存。安装标识由本机随机生成并持久化，不读取硬件标识。
- 视觉组件目前是临时基础设施，不代表舍友正在设计的最终 UI。

当前大厅具备真实列表 UI；Login 有手机号验证码表单，Profile 有当前会话信息和退出登录入口。DemandDetail、Publish、Message、Order 仍是导航目标或占位页面，不要把 Web 端已经实现的业务功能算作鸿蒙端已完成。

## 构建

在 DevEco Studio 中打开本目录，选择 API 26.0.0 后执行 Build。

命令行构建需要把 DevEco Studio 自带的 Node、Hvigor 和 SDK 加入当前终端环境。路径使用本机实际安装位置，不要提交个人绝对路径：

```powershell
$env:NODE_HOME = '<DevEcoStudio>/tools/node'
$env:DEVECO_SDK_HOME = '<DevEcoStudio>/sdk'
$env:PATH = "$env:NODE_HOME;<DevEcoStudio>/tools/hvigor/bin;<DevEcoStudio>/tools/ohpm/bin;" + $env:PATH
<DevEcoStudio>/tools/hvigor/bin/hvigorw.bat assembleHap --no-daemon
```

当前构建可以生成未签名 HAP；华为账号、AGC、最终 bundleName 和调试签名仍未确认，因此暂不能宣称已安装运行。

## 环境和接口状态

工程提供 `dev`、`staging`、`production` 三个 Build Product，运行时环境来自生成的 `BuildProfile`，不再固定返回 DEV。地址必须在构建前通过进程环境变量 `PORTRA_BASE_URL` 提供；未提供时网络保持禁用，不会回退到某个开发者的个人 IP。

开发设备与电脑处于同一局域网时，先用 `ipconfig` 找到电脑可达的 IPv4 地址，再执行：

```powershell
$env:PORTRA_BASE_URL = 'http://<电脑局域网IPv4>:8080'
& "<DevEcoStudio>/tools/hvigor/bin/hvigorw.bat" assembleHap --no-daemon `
  -p product=dev
```

`PORTRA_BASE_URL` 只对当前终端进程有效，不会写入源码或 Git。`127.0.0.1` 在手机或模拟器里通常指设备自身，不能代替电脑地址。后端还必须监听局域网接口，Windows 防火墙也必须允许对应开发端口；这些条件由实际联调确认。Staging 和 Production 必须选择相应 Product，并先把该环境变量设置为团队确认的 HTTPS origin，再构建；Hvigor 和应用运行时都会拒绝这两个环境的 HTTP 地址。

系统网络策略也按 Product 对应的模块 Target 隔离：`default/dev` 构建才包含允许开发 HTTP 的配置，`staging/production` 构建均显式禁止明文流量；应用层的 `EnvironmentConfig` 还会再次拒绝非 DEV 环境的 HTTP 地址。该配置不关闭或绕过 HTTPS 证书校验。DevEco Studio 中也必须选择与目标一致的 Product。

团队当前临时 Staging 地址为 `https://47.76.106.57`。需要设备联调时，可在当前终端设置 `$env:PORTRA_BASE_URL = 'https://47.76.106.57'`，再以 `-p product=staging` 构建；这只是构建配置示例，不代表该地址已在鸿蒙设备上验证。正式 Production 地址尚未确认，也不要把临时 Staging IP 固化进源码。

当前已核对的公开接口是：

- `GET /demands?page=1&size=10`
- `GET /service-packages?page=1&size=10`

2026-09-29 从本地对临时 Staging 只读探测，两条接口均返回 HTTP 200、业务码 200：需求列表为 0 条，摄影橱窗列表为 1 条测试数据。此前 `moderation_status` 缺列导致的错误在这两条接口上已不再出现；这不证明全库迁移或设备联调完成。大厅代码已请求真实列表，D08 仍需在鸿蒙设备上确认加载、空状态、图片回退和错误重试。

临时 Staging 的后端配置为 `temp-staging`，该运行配置当前使用 `DisabledSmsSender`，因此即使客户端登录页面已接线，也不能把收取真实短信并登录记为完成。启用团队认可的短信发送环境后再进行人工联调；不要用固定验证码或假登录绕过。

正式大厅只调用上述真实接口，并覆盖 Loading、Empty、Error 和正常列表状态。视觉对照数据仅位于 `entry/src/ohosTest/ets/preview/HallPreview.ets`；DevEco 要求 Preview 入口位于 `src/main/ets`，因此请打开不含数据且未注册到正式页面的 `entry/src/main/ets/preview/HallPreviewEntry.ets`。该入口包含镜头与约拍的 360、390、430 vp 预览，以及 Loading、Empty、Error、长中文、无头像、无图片和长价格/预算边界预览。频道切换会把内容滚动位置复位到顶部，避免较长的镜头列表把旧滚动位置带入约拍列表。默认 HAP 仍需通过示例数据泄漏检查。当前没有连接模拟器或真机，因此系统字体放大和安全区仍需在 Preview 或设备上完成最终视觉验收。

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

七个第一阶段目标统一由 `NavigationPolicy` 管理。Login、Hall、DemandDetail 是公开入口；Publish、Message、Order、Profile 在游客状态下进入 Login，并保留原目标。DemandDetail 只接受正的安全整数 `demandId`。登录成功后返回原目标；首次安装且无有效凭据时按游客状态运行。

```powershell
& "$env:NODE_HOME/node.exe" --test tests/navigation.test.cjs
```

该测试检查七个路由名称、公开/认证入口、登录前目标和详情参数。快速点击由页面入口的 350 ms 保护处理，返回由 `NavPathStack.pop()` 和系统 Navigation 栈处理；设备上的物理返回键和完整交互仍在最后的安装验收中确认。

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
