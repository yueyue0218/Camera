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
