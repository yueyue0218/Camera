# A-PERF-03 Image Variants — 本地 After 证据

## 结论边界

本文件只记录 A 侧在本地自动化测试中得到的证据。完整后端测试套件已在记录的 Windows/JDK loopback 回退参数下通过；未进行浏览器人工验收、staging 验收或 nginx/HTTPS/CDN 验证。

## Commit 与环境

- 日期：2026-09-23（Asia/Shanghai）
- 工作树：`C:\Users\LiXiaozhou\Camera-A-ProfileBaseline`
- 分支：`codex/a-perf-03-image-variants`
- 基线 HEAD：`e410d5e1ecdad6e0969de0d7520a782bc45a36ec`
- 本轮交付状态以当前分支最新 commit 与 PR 记录为准；本文记录提交前本地验证证据
- Windows 11 amd64
- Java 17.0.12
- Maven 3.9.15
- Node v24.15.0
- npm 11.12.1

## Endpoint status / MIME 矩阵

以下 transport 结果由 `FileControllerTest` 的独立 MockMvc 端点测试验证；不是 staging 实测。

| 场景 | 路径/条件 | HTTP | Content-Type | 其他断言 |
| --- | --- | ---: | --- | --- |
| thumbnail 存在 | `/files/42/thumbnail` | 200 | `image/webp` | `Content-Disposition: inline`，返回图片字节 |
| original 存在 | `/files/42/original` | 200 | `image/png` | `Content-Disposition: inline`，原字节 |
| legacy download | `/files/42/download` | 200 | `image/png` | 保留 attachment 语义 |
| FileRecord 不存在 | `/files/404/thumbnail` | 404 | `application/json` | business code `40401` |
| 物理原图不存在 | `/files/42/medium` | 404 | `application/json` | business code `40401` |
| 非法 variant | `/files/42/huge` | 400 | `application/json` | business code `40001` |
| 非法 fileId | `/files/not-a-number/thumbnail` | 400 | `application/json` | business code `40001` |
| 匿名/未认证访问私有文件 | File access policy 拒绝 + controller 401 映射 | 401 | `application/json` | business code `40101` |
| 已认证但无权访问 | controller policy failure | 403 | `application/json` | business code `40301` |
| 非图片请求 derivative | thumbnail + `application/pdf` | 415 | `application/json` | 不把 JSON 当作图片 Blob |
| 伪装成 raster 的 SVG/未知格式 | original / derivative | 415 | `application/json` | 不信任数据库 MIME 或文件扩展名 |
| 生成/IO 失败 | thumbnail generation failure | 500 | `application/json` | business code `50001` |

对应命令：

```powershell
.\mvnw.cmd "-Dtest=RasterImageInspectorTest,ImageVariantRendererTest,LocalImageVariantStorageTest,ImageVariantServiceTest,FileControllerTest,FileServiceTest,FileAccessPolicyTest,AuthInterceptorTest" test
```

观察结果：`Tests run: 44, Failures: 0, Errors: 0, Skipped: 0`，`BUILD SUCCESS`，总耗时 `32.617 s`。

## 尺寸、MIME 与透明度

固定夹具的自动化观察值：

| 输入夹具 | representation | 输出 | 观察值 |
| --- | --- | --- | --- |
| 2400×1800 JPEG | thumbnail | WebP | `image/webp`，640×480 |
| 2400×1800 JPEG | medium | WebP | `image/webp`，1600×1200 |
| 900×600 transparent PNG | thumbnail | 可解码图片 | 640×427，alpha 保留 |
| 320×200 opaque PNG | thumbnail | 可解码图片 | 320×200，不放大 |
| WebP encoder 不可用 + alpha | thumbnail | PNG fallback | `image/png` / `.png`，alpha 保留 |
| WebP encoder 不可用 + opaque | thumbnail | JPEG fallback | `image/jpeg` / `.jpg` |

因此像素值是当前实现与测试建议，不作为业务 DTO 或不可变 API contract；冻结的是 `thumbnail`、`medium`、`original` representation 语义。

## Lazy generation 与复用

- 派生文件确定性路径：`derived/{fileId}/{variant}.{webp|png|jpg}`。
- 写入使用同目录临时文件并原子发布；自动化断言目录内无残留 `.tmp`。
- 两个并发首次请求由同一进程内 key lock 收敛为一次 renderer 调用，两个调用者只读到完整派生文件。
- 2400×1800 JPEG 首次生成 thumbnail 后，测试把派生文件 mtime 固定为 `1700000000000` ms；第二次请求返回同一路径且 mtime 保持不变，证明命中已持久化文件而非重写。
- `original` 直接读取原文件，不调用 renderer，也不查询 derivative storage；响应 MIME 由文件字节实际识别结果决定，不信任数据库 MIME。

## 图片解码与 original 安全边界

- 上传与 derivative generation 共用 `RasterImageInspector`：先用 `ImageReader` 读取宽高，再决定是否解码。
- 默认限制为单边不超过 `16384` px、总像素不超过 `64,000,000`，分别可由 `CAMERA_FILES_IMAGE_MAX_WIDTH`、`CAMERA_FILES_IMAGE_MAX_HEIGHT`、`CAMERA_FILES_IMAGE_MAX_PIXELS` 配置。
- derivative decode 在通过限制后使用 source subsampling，避免为缩略图先分配完整原图 raster。
- 单文件通用上传会探测真实 raster；即使调用者把 PNG/JPEG 标成 `application/octet-stream`，仍会执行像素与图片字节上限检查。无法识别为 raster 的 PDF/ZIP 等通用附件保持兼容。
- `/original` 只允许实际可识别的 JPEG、PNG、WebP、GIF；SVG、未知格式和伪装内容返回 HTTP 415。

## Browser 路由映射

- 卡片封面与所有冻结头像场景使用 `{ variant: 'thumbnail' }`。
- Demand 详情 reference images 与 ServicePackage 详情 portfolio images 使用 `{ variant: 'medium' }`。
- Delivery 与 Order 下载仍不传 variant，继续走默认 `/download`。
- `fileApi.downloadObjectUrl` 默认仍为 `/download`；只有调用者明确提供 `options.variant` 时才选择 representation。
- binary helper 对 thumbnail/medium/original 要求 HTTP 2xx 且 `Content-Type: image/*`；legacy `/download` 允许 ZIP、PDF 等合法二进制，但 HTTP 200 + JSON 会在 Blob 转换前拒绝。
- ServicePackage `coverImage` / `images` legacy URL fallback 顺序保持不变。
- Moment 继续消费既有 `imageData` / `imageDataList`，本轮没有迁移 Base64 模型。

## Reference validation

- Demand `referenceFileIds` 与 ServicePackage `portfolioIds` 只在 create/update 写路径执行批量存在性校验。
- 输入先移除 null 并稳定去重；空输入不查询；缺失 ID 以 validation error 拒绝，且在持久化/替换前失败。
- 本轮没有宣称 ownership 或 bizType 校验；当前 FileRecord 数据不足以可靠证明 ownership/bizType 绑定。
- 读取路径没有逐图片预检，单个资源缺失仍由图片请求局部降级，不使整个业务 DTO/page 失败。

对应命令：

```powershell
.\mvnw.cmd "-Dtest=FileReferenceValidatorTest,DemandServiceTest,ServicePackageServiceTest,ServicePackageFlowTest" test
```

观察结果：`Tests run: 118, Failures: 0, Errors: 0, Skipped: 0`，`BUILD SUCCESS`，总耗时 `49.670 s`。

## 后端完整回归结果

### 本机 loopback 根因与规避

最初直接执行完整套件时出现 196 个 environment errors。最小化到纯 JDK `Selector.open()` 后仍可复现：Windows JDK 17.0.12 的 `PipeImpl` 首选 Unix-domain socket 建立内部 selector wakeup pipe，但本机连接返回 `SocketException: Invalid argument: connect`，继而表现为 `Unable to establish loopback connection`。这不是 Portra 业务逻辑、Spring 或 Tomcat 断言失败。

本机验证的规避方式是把 `jdk.net.unixdomain.tmpdir` 指向不存在的驱动器路径，使 JDK 的 Unix-domain bind 失败并走其内建 TCP loopback fallback：

```powershell
.\mvnw.cmd "-Djdk.net.unixdomain.tmpdir=Z:\codex-no-unix-socket" test
```

最小 JDK probe 在不带参数时失败，带参数时 `Selector.open()` 成功；原先受阻的 `DemandIntegrationTest` 随后 17/17 通过。

### 完整套件结果

第一次解除环境限制后，套件暴露出 15 个真实测试失败：三个旧集成测试使用 `portfolioIds` / `referenceFileIds` 的固定值 `11/12`，但没有为本轮新增的存在性校验准备 `files` 记录。生产校验未放宽；只为这些测试补齐了真实 `FileRecord` fixture。

最终观察结果：

- Maven 退出码：`0`
- Surefire 汇总：`Tests run: 710, Failures: 0, Errors: 0, Skipped: 2`
- Test suites：80
- Surefire testsuite time 合计：`138.781 s`
- 12-user Profile social SQL probe 仍输出：followers `8`、following customer `8`、following provider `8`

结论：本地完整后端套件可标记为 GREEN，但在这台 Windows 主机上必须使用上述 JDK 回退参数。标准开发机或 CI 若没有同一 JDK Unix-domain socket 异常，可正常直接执行 `mvnw test`；若复现，则使用相同 JVM 参数或修复主机/JDK 的 Unix-domain socket 支持。

## 前端 test / lint / build

执行命令：

```powershell
npm test
npm run lint
npm run build
```

观察结果：

- `npm test`：66/66 通过。
- `npm run lint`：退出码 0，0 errors；存在 38 个仓库既有 unused warnings。
- `npm run build`：Vite 成功，1213 modules transformed，`built in 14.11s`。
- build 仍报告既有 dynamic/static import 提示及大于 500 kB chunk 的 warning；本轮未扩大范围处理 bundle split。

## Scope 与兼容性机械检查

执行：

```powershell
git diff -U0 | rg "^\+.*(thumbnailFileId|mediumFileId|derivative.*@Entity)"
rg -n "image_data|imageData" backend/src/main/java/com/action/camera/social frontend/src/pages/feed
rg -n "portfolioIds|coverPortfolioId|coverImage|images" backend/src/main/java/com/action/camera/servicepackage
git diff --check
```

观察：

- 没有新增 derivative entity 或新的 thumbnail/medium DTO fileId 字段。
- 全仓搜索命中的 `DemandCard.thumbnailFileId` 已存在于基线 HEAD，不是本轮新增 contract。
- Moment `image_data MEDIUMTEXT`、`imageData`、`imageDataList` 路径仍存在。
- ServicePackage 新 `portfolioIds` / `coverPortfolioId` 与旧 `images` / `coverImage` 同时存在。
- `git diff --check` 未报告空白错误；只显示 Windows LF→CRLF 工作树提示。

## 交给 C 的 nginx / staging 验证项

C 仍负责且本文件不代替以下验收：

- nginx/static delivery routing 与 HTTPS 行为；
- `Cache-Control`、缓存 key、immutable URL/versioning 策略；
- reverse-proxy 是否透传真实 HTTP status 与 `Content-Type`；
- request/upstream timing；
- 同一 derivative 首次与第二次加载的 network/缓存对比；
- 冻结的四个 staging 场景与带头像/无头像请求分项统计；
- CDN 或静态交付基础设施。

## 未执行项目

- 未执行浏览器人工验收。
- 未执行 staging 性能测量。
- 未修改 nginx、HTTPS、CDN 或静态交付配置。
- 未迁移 Moment Base64。
- 未删除 ServicePackage legacy URL。
- 未执行 `git add`、`commit`、`push` 或 `merge`。
