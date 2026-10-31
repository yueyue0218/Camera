# Portra 定位与省级地区专项交付

基线：`integration/harmony-v1`，`49e224dc97c4e18800a0ef8aac2c1ac72b7a45db`。
修复分支：`codex/portra-province-location-fix`。参考实现固定为 `6f5163871b02e3ef66579eddeb7f7af3bf11a3c6`。

用户已要求自行进行设备验收。本阶段不打开、操作、安装或改变模拟器，不把自动化测试当作设备运行证据。设备上的旧包 SHA 仍未知；第一阶段读取到的版本、权限状态是历史快照，不代表本次修复后的状态。

## 根因与修复范围

1. 集成基线没有 `ProvinceLocation`，旧 `HallControls.HallFilters` 只有排序，权限清单只有网络。不能将参考分支或本地旧 HAP 当作该基线已经部署的定位实现。
2. 参考实现按 `phase='switch'` 选择关闭提示，导致开关查询抛出 `801`、`3301000` 时，实际开关尚未知也出现关闭引导。修复以 `LocationFailure.kind` 和系统错误码区分故障，开关状态仅为 `on/off/unknown`。
3. 开关查询和权限检查的异常保留错误码；不把检查失败当成用户拒绝后再次弹窗。单次定位使用当前 SDK 的 `FIRST_FIX`、`timeoutMs=10000` 和前台大致位置权限。
4. 权限撤销事件立即清除缓存、使在途请求失效并通知界面。后台后不复用旧缓存，前台重新检查开关和授权；系统设置返回后的重试不会发起第二套服务。
5. 观察者逐个隔离异常；主页和大厅订阅同一地区和定位中状态。手动选择、页面离开、导航不可见或会话变化，都会阻止旧回调覆盖当前选择。
6. 坐标仅用于当前调用栈的系统逆地理编码。缓存仅保留省级代码、完整名称和十分钟有效期；不缓存城市街道、坐标或完整地址，不写入公开用户资料。
7. 两端原先分别发送中文省名和两字母代码，后端普通分页 SQL 与推荐路径还存在精确匹配。现在创建、编辑、查询和显示采用统一目录，SQL 数据与 count 谓词相同，在分页前兼容旧数据，推荐路径也使用同一匹配规则。
8. Web 和旧登录逻辑存在不经明确操作的 IP 归属地公开回写。现已移除浏览器的高德/IP 自动探测及回写，停用后端 IP 推断；用户明确编辑资料时才修改公开地区。该小类保留注入签名，未引入新的第三方位置服务。

## 地区数据契约

- API 字段和数据库列仍为 `cityCode` / `city_code`，没有字段重命名或生产数据迁移。
- 新写入使用 Web 现有两字母省级代码，如 `JS/ZJ/GD/BJ/HK/MO/TW`；界面显示 `江苏省/浙江省/广东省/北京市/香港特别行政区/澳门特别行政区/台湾省`。
- 唯一源数据为 `shared/regions/provinces.json`。`python tools/generate_provinces.py` 生成 Harmony `ProvinceCatalog`、Web `ProvinceCatalog`、Backend `ProvinceNames`，共 34 项：23 省、5 自治区、4 直辖市、2 特别行政区。
- 目录中的城市仅是历史兼容别名，绝不是选择项。`南京/南京市/NJ/JS/江苏/江苏省/320102` 均归为 `JS`；杭州归浙江、深圳归广东。代码和英文历史别名忽略大小写。
- 六位纯数字旧值按有效省级前缀归类；这不是完整的区县代码有效性数据库。`320ABC`、未知前缀不会归类。市级别名表覆盖已知历史形式，不推测未知城市或校园名称的省份。
- 空筛选表示不限；未知查询值保持原值精确匹配，绝不变成不限或江苏。未知历史展示显示“未识别地区”，编辑时必须重新选择。未知新写入返回验证错误。
- 需求地点与服务范围单独保留城市、校园等文本，不进入省级字段。未执行批量重写，已有订单、用户和历史记录保持原存储。

## 按文件迁移的依赖

从参考分支选择迁移并适配：

- `privacy/PrivacyConsentStore.ets`、`PrivacyConsentPage.ets`、`LegalDocumentContent.ets`：本地双重同意、原存储键及版本、撤销状态。定位确认不替代整体隐私同意。
- `features/publish/PublishDraftStore.ets`、`JournalText.ets`、`JournalUI.ets`、`pages/PublishPage.ets`：需求和橱窗创建、编辑、预览、草稿及真实上传。省级值在恢复和提交边界再次规范化。
- `features/hall/HallFilterOptions.ets`、`HallFilterState.ets`：选择项来自目录，查询发出代码。原排序控件保留，新 `HallFilters` 将地区选择接入真实列表请求。
- `network/ImageUpload.ets`、`FileImageService.ets`、`common/components/PortraImage.ets`、`ComponentPolicy.ets`：橱窗图片上传与受认证的预览所需最小依赖，`HttpClient` 增补原有认证/取消边界内的二进制和 multipart 支持。
- `common/performance/UiPerf.ets`、`features/user/ContentChanges.ets`：安全阶段日志及发布后刷新。

没有整分支合并。后端仅新增地区目录/SQL 兼容及相应服务、资料边界调整，没有复制整个后端模块。

注意：集成基线没有参考分支的服务端隐私权利模块。本次迁移本地同意门控，不假设不存在的服务器同意接口已可用，也不自动确认 `pendingServerGrant`。跨设备服务端撤销同步不属于此次已实现的本地门控能力。

## 故障分类与可执行降级

| 条件 | 类型与提示操作 |
| --- | --- |
| `isLocationEnabled() === false`，或 `3301100` | `switch-off`：开启手机位置总开关，返回后重检；手动选择始终可用 |
| 用户拒绝；`201` | `permission-denied`：说明权限拒绝或校验失败；系统不再弹窗时提供显式权限设置入口 |
| `3301000` | `service-unavailable`：系统位置服务暂不可用，稍后重试或手动选择 |
| `3301200` | `position-unavailable`：未取得位置或超时，检查网络和信号；不推断总开关关闭 |
| `3301300` | `geocoder-failed`：已取得位置，地区解析失败，检查网络或手动选择 |
| `801` | 按失败接口区分 `unsupported` / `geocoder-unsupported`，说明设备能力限制 |
| `isGeocoderAvailable() === false` | `geocoder-unsupported`，直接手动选择 |
| 空结果、无法识别省份、境外地址 | `region-invalid`，不制造地区，直接手动选择 |
| 隐私撤销、会话变化 | 立即清缓存、使在途结果过期；不更新公开资料或当前选择 |

手动选择按钮直接打开 34 项真实选择器，选择后重置大厅分页并将代码传入列表 API。发布不依赖定位成功。

官方接口说明：<https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-geolocationmanager>。
可读取的官方 OpenHarmony 接口及错误码：
<https://github.com/openharmony/docs/blob/master/zh-cn/application-dev/reference/apis-location-kit/js-apis-geoLocationManager.md>、
<https://github.com/openharmony/docs/blob/master/zh-cn/application-dev/reference/apis-location-kit/errorcode-geoLocationManager.md>。
本机 SDK 为 HarmonyOS 26.0.0.105 / API 26，`isLocationEnabled` 为同步布尔接口，声明的查询异常包括 `801/3301000`。官方错误说明也指出 x86 模拟器可能无法完成逆地理编码，必须独立记录能力失败。

## 自动化验证与设备边界

最终计数、构建 SHA、产物 SHA256 见随交付目录的 `validation-summary.json` / `artifact-provenance.json`。

| 检查 | 结果 |
| --- | --- |
| Harmony 全套 | 333/333，通过，无 skip |
| 定位专项（含地区边界） | 25/25，通过；均为受控系统替身，不是设备结果 |
| 地区相关 Backend 回归 | 139/139，通过；含两类内容控制器、服务和 H2 数据库链路 |
| Backend 完整回归 | 840：783 通过、55 启动/环境错误、2 个既有可选 MySQL smoke 跳过；不宣称全绿 |
| Backend 55 项复验 | IPv4 参数及已安装 JBR 25 复验仍受本机 loopback 初始化失败阻断，无业务断言失败；未改系统设置 |
| Web 全部文件 | 97：96 通过、1 失败；省级地区新增 4/4 通过 |
| Web 失败的基线对照 | 原集成分支举报用例 22：21 通过、同一项失败 |
| ArkTS / Web 构建 | 候选构建通过；最终 HAP 用提交 SHA 重建，详情随产物附带 |
| 设备交互和真实定位 | 未验证，按用户要求留待自行验收 |


- ArkTS `assembleHap`：已通过候选编译；最终产物在提交后使用精确源码 SHA 构建。
- Harmony：定位、授权、缓存、观察者、生命周期与实际查询/载荷转换测试，全套结果记录于验证汇总。
- Backend：真实 MockMvc + H2 创建/编辑/查询测试、历史别名数据库分页与总数测试，以及完整回归结果分别记录。
- Web：目录与两类发布载荷测试通过，生产构建通过。原有举报测试 `late service provider response cannot expose a report for a previous route` 失败；未改动集成基线复跑也以相同断言失败（它期待迟到响应恢复旧标题）。未修改该无关测试来掩盖结果。
- 本地 HAP 是 **unsigned debug**，仓库未配置发布签名。未宣称可直接安装，未安装到模拟器；由用户使用自己的 DevEco 签名和后端地址进行验收。
- SQL 已在 H2 MySQL 模式验证；未部署后端、未运行生产 MySQL 数据迁移。旧数据兼容依赖本 PR 后端与客户端协调上线。

## 用户自行验收清单

所有以下设备场景当前均为 **未验证**。先在 DevEco 打开本修复 worktree 的 `harmony`，选择正确 API 地址和自己的调试签名，构建并安装 1.0.1 (`versionCode=1000001`)；从 `PortraBuild` 日志核对源码 SHA，避免继续运行旧包。构建产物默认 dev 测试地址为 `http://127.0.0.1:18090`，这是开发地址，不代表现网后端已部署。必须按自己的验收环境配置后端连通性。

| 场景 | 应观察结果 | 当前结果 |
| --- | --- | --- |
| 系统位置明确关闭，再开启并返回 | 开关 off；未提前申请权限；重新检查后可重试 | 未验证 |
| 当前模拟器开关 API | 实际返回 on/off，或 unknown + 原始 801/3301000 | 未验证 |
| 首次授权、已授权 | 仅请求前台大致位置；已授权不重复弹窗 | 未验证 |
| 拒绝、系统不再弹窗 | 权限原因准确，显式设置与手动选择可用 | 未验证 |
| 撤权再授权 | 旧缓存不恢复；重新获取才展示新结果 | 未验证 |
| 单次位置 | coordinates start → valid，或实际错误码；不记录坐标值 | 未验证 |
| 逆地理编码 | resolved，或 unsupported/3301300；不能将失败记成取得省份 | 未验证 |
| 已配置测试坐标的模拟器 | 逐阶段观测；不会把“GPS 已配置”当作定位成功 | 未验证 |
| 主页/大厅、重复点击、页面和角色切换 | 一套请求，加载和结果同步；旧回调不覆盖新状态 | 未验证 |
| 手动选江苏、翻页 | 请求含 cityCode=JS；历史南京内容及总数正确 | 未验证 |
| 需求/橱窗创建、编辑、预览、草稿恢复 | 显示完整省名，存储两字母代码，未知值需重选 | 未验证 |
| 隐私撤销 | 缓存立即清理，停止调用定位，不自动写公开资料 | 未验证 |

用户完成操作后，可自行运行 `harmony/tools/collect-location-diagnostics.ps1` 收集白名单事件。脚本只读取已有日志，不开启模拟器、不主动定位，不保存完整日志、坐标、住址或凭据。真机仍需验证实际省份解析成功、网络环境和系统授权往返。
