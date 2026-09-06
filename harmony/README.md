# Portra HarmonyOS 客户端

本目录是 Portra 在现有仓库中的原生 HarmonyOS 客户端。它不会复制或重写 `frontend/`、`backend/`，而是通过 HTTP 访问现有 Spring Boot 服务。

## 当前范围

- ArkTS/ArkUI Stage 工程，目标 SDK 26.0.0。
- App Shell 和原生 Navigation 已建立，包含 Login、Hall、DemandDetail、Publish、Message、Order、Profile 入口。
- 网络底座已建立：`HttpClient`、`ApiService`、错误映射、Bearer Token 注入、请求取消和旧响应保护。
- 客户端认证状态已建立状态边界；安全凭据存储等待 B 确认最终登录/Session 契约后接入。
- 视觉组件目前是临时基础设施，不代表舍友正在设计的最终 UI。

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

当前 `dev` 默认地址是 `http://127.0.0.1:8080`，只适合本机开发。真机联调必须替换为电脑可达的局域网地址；`staging` 和 `production` 在地址确认前保持禁用。

当前已核对的公开接口是：

- `GET /demands?page=1&size=10`
- `GET /service-packages?page=1&size=10`

本地后端目前会返回业务错误 `code=50001`，原因是数据库缺少 `moderation_status` 字段。该问题交由 A 确认迁移方案；在修复前不使用假数据完成 D08。

## 提交边界

以下内容由工程忽略，不应提交：`build/`、`.hvigor/`、`oh_modules/`、`.idea/`、`local.properties` 和 HAP 构建产物。签名私钥、密码、token 和个人路径也不得提交。

## D07 网络逻辑验证

在本目录执行（沿用上面的 `DEVECO_SDK_HOME`、`NODE_HOME`）：

```powershell
& "$env:NODE_HOME/node.exe" --test tests/network.test.cjs
```

测试加载实际网络层 `.ets` 源码，使用 SDK 自带的 TypeScript 转译器和隔离的 NetworkKit 测试替身。覆盖 19 项：成功/合法空值、畸形响应、HTTP 与业务错误、超时、取消、旧响应、凭据变更、公开接口和地址约束。测试数据仅用于验证逻辑，不进入业务页面，不证明数据库或设备联调通过；ArkTS 兼容性另由 `assembleHap` 检查。

两条公开列表使用 `getPublic`，即使本地存在 token 也不附带认证头。其他 `get` 请求可携带 Bearer；通过 HttpClient 设置或清除 token 时会取消在途请求。所有请求禁用自动重定向与 HTTP 缓存；50001 等错误不直接展示后端 SQL 文本。超时码 2300028 依据本地 SDK 声明和[华为 HTTP 文档](https://developer.huawei.com/consumer/en/doc/harmonyos-references-V13/js-apis-http-V13)。

限制：当前仅校验统一响应包装，具体列表记录的字段校验和真实数据接入留待 D08。401/40101 已映射为认证错误，但尚未接通会话自动退出；D10 安全存储与会话联动仍未完成。环境缓存命名空间目前只是配置，尚未接入持久化存储，不能据此认定凭据隔离已经验收。

## D09 导航逻辑验证

七个第一阶段目标统一由 `NavigationPolicy` 管理。Login、Hall、DemandDetail 是公开入口；Publish、Message、Order、Profile 在游客状态下进入 Login，并保留原目标。DemandDetail 只接受正的安全整数 `demandId`。当前登录协议尚未接通，所以应用壳按游客状态运行。

```powershell
& "$env:NODE_HOME/node.exe" --test tests/navigation.test.cjs
```

该测试检查七个路由名称、公开/认证入口、登录前目标和详情参数。快速点击由页面入口的 350 ms 保护处理，返回由 `NavPathStack.pop()` 和系统 Navigation 栈处理；设备上的物理返回键和完整交互仍在最后的安装验收中确认。
