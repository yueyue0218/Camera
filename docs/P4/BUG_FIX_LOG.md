# Bug 修复日志 — Phase 4

**项目：** Camera 摄影接单平台  
**阶段：** 第 10-14 周（Phase 4 编码开发）  
**记录人：** 全体成员  
**最后更新：** 2026-06-07

---

## 一、日志说明

本日志记录 Phase 4 编码与联调阶段出现的典型 Bug，包含问题现象、根因分析、修复方案和验证结果。每条记录对应一个或一组相关 git commit。

---

## Bug #1 — 发布需求时预算价格传入后端为 NaN / 异常负值

| 项 | 内容 |
|---|---|
| **发现时间** | 2026-06-07 |
| **发现方式** | 前后端联调，发布需求后查看后端接收到的 payload |
| **严重程度** | P0（核心功能不可用） |
| **修复 commit** | `2d7d9ac` [AI-assisted] fix publish price payloads |
| **负责人** | 王雯 |

### 问题现象

用户在发布需求页面填写预算区间（元）后提交，后端接收到的 `budgetMinCent` 和 `budgetMaxCent` 字段出现以下异常：
- 输入空值时传入 `NaN`（后端校验报 400）
- 输入非数字时传入 `NaN`
- 前端表单合法性未校验，最大值可低于最小值

### 根因分析

`buildDemandPayload` 中直接调用了公共工具函数 `yuanToCent(value)`，该函数对空字符串 `""` 和 `null` 不做保护，直接执行 `Number("") * 100 = 0` 或 `Number(null) * 100 = 0`——但更严重的是，当输入为非数字字符串时返回 `NaN * 100 = NaN`，并以 `NaN` 原样放入 payload 发送给后端。此外，发布流程缺少表单级校验（预算上限不得小于下限）。

### 修复方案

在 `publishFormUtils.js` 中封装 `yuanToValidCent(value)`，对空值返回 `null`、对非合法数值返回 `null`，替换原来的直接调用。同步新增 `validateDemandForm(form)` 函数校验预算区间的合法性，前端在提交前调用并拦截非法输入。

```js
// 修复前
budgetMinCent: yuanToCent(form.budgetMinYuan),  // 空值传 NaN

// 修复后
budgetMinCent: yuanToValidCent(form.budgetMinYuan),  // 空值传 null
```

### 验证结果

- 空预算字段提交：后端收到 `null`，正常处理
- 非数字输入：前端校验拦截，不发送请求
- 最大值 < 最小值：前端提示错误，不发送请求
- 正常预算区间：发布成功，后端存储金额单位正确（分）

---

## Bug #2 — 评价投诉仲裁后信用分变化方向错误，CI 测试失败

| 项 | 内容 |
|---|---|
| **发现时间** | 2026-06-07 |
| **发现方式** | CI 流水线（`backend_test` stage）自动运行失败 |
| **严重程度** | P1（业务逻辑错误 + CI 阻塞） |
| **修复 commit** | `60b68b3` [AI-assisted] fix backend CI regressions |
| **负责人** | 王雯 |

### 问题现象

CI 流水线 `mvn test` 阶段红灯，`ReviewComplaintServiceTest` 和 `ReviewServiceTest` 中多个断言失败，具体为：仲裁后信用分变化数值与预期不符。

### 根因分析

`ReviewComplaintService.calculateReviewScoreChange(Integer rating)` 方法的逻辑来自早期草稿，当时将 5 星设定为 `+2`（奖励），4 星 `+1`，依此类推。但后续业务设计调整：该方法实际用于**投诉仲裁时对被投诉方的信用惩罚**，信用分只应减少不应增加，5 星代表投诉人认为对方表现好（惩罚轻），1 星代表表现差（惩罚重）。代码逻辑与业务含义完全颠倒，测试用例按新业务含义编写，与代码不符导致 CI 失败。

### 修复方案

按照正确业务语义重新设定各评分对应的信用变化值（全部为 0 或负数）：

```java
// 修复前（错误方向）
case 5 -> 2;   case 4 -> 1;   case 3 -> 0;
case 2 -> -2;  case 1 -> -5;

// 修复后（惩罚方向）
case 5 -> 0;   case 4 -> -1;  case 3 -> -2;
case 2 -> -3;  case 1 -> -4;
```

### 验证结果

- CI 流水线重新触发：`backend_test` 阶段绿灯
- 本地 `mvn "-Dtest=ReviewComplaintServiceTest,ReviewServiceTest" test`：27 tests，0 failures

---

## Bug #3 — 大厅摄影师卡片头像与用户档案不一致

| 项 | 内容 |
|---|---|
| **发现时间** | 2026-06-07 |
| **发现方式** | 前端人工测试，对比大厅页和个人主页 |
| **严重程度** | P1（视觉体验明显错误） |
| **修复 commit** | `c158200` Fix hall avatars from user profile |
| **负责人** | 曹潇月 |

### 问题现象

在订单大厅和摄影师橱窗中，部分摄影师卡片显示的头像与其个人主页的头像不一致；同一个用户的头像在不同页面呈现不同内容（有时显示默认占位图，有时显示真实头像）。

### 根因分析

`UserService` 返回用户摘要时，大厅相关接口走了旧的字段映射路径，头像字段使用了数据库中另一列的值（`profile_picture_url` vs `avatar_url`）；前端 `HallPage` 和 `HallDetailPages` 在渲染头像时也没有统一使用 `AuthContext` 中已缓存的当前用户头像来源，导致同一用户在不同场景下取值路径不同、显示不同。

### 修复方案

- 后端 `UserService`：统一头像字段来源，确保大厅摘要接口与个人资料接口返回同一字段
- 前端 `HallPage` / `HallDetailPages`：统一读取 `user.avatarUrl`，不再混用多个字段名
- 前端 `ProfilePage`：同步修正公开主页头像读取路径，与大厅保持一致
- `AuthContext`：补充头像字段的初始化赋值，保证登录后缓存完整

### 验证结果

- 登录后进入大厅，摄影师头像与其个人主页一致
- 切换不同账号测试，头像显示正确
- 未登录状态下大厅使用占位图，符合预期

---

## Bug #4 — 消息会话列表对方身份显示为自己

| 项 | 内容 |
|---|---|
| **发现时间** | 2026-06-07 |
| **发现方式** | 前端联调，查看消息列表时发现显示异常 |
| **严重程度** | P1（功能性错误，影响消息模块体验） |
| **修复 commit** | `ddc2b3d` fix: resolve real participant identity in message list |
| **负责人** | 牛郝彦姝 |

### 问题现象

消息列表中，部分会话卡片显示的对方名称和头像是当前登录用户自己，而非真实的对话对方；点击进入会话后头部显示正确，列表与详情不一致。

### 根因分析

`participantResolver.js` 在解析会话参与者时，从会话的 `participants` 数组中取第一个元素作为"对方"，但后端返回的参与者列表顺序不固定，有时当前用户排在第一位，导致显示了自己。`ConversationList` 组件也没有对解析结果做合法性校验（是否与当前用户 ID 相同）。

### 修复方案

- `participantResolver.js`：遍历 `participants` 数组，过滤掉与当前登录用户 ID 相同的条目，取剩余第一个作为对方
- `ConversationList.jsx`：增加兜底逻辑，若解析结果仍为自身 ID，显示占位内容而非错误数据

### 验证结果

- 登录不同账号，消息列表对方身份显示正确
- 与自己发起的测试会话（如 debug 数据）也不再显示错误

---

## Bug #5 — 动态广场发布大图时报错，图片数据被截断

| 项 | 内容 |
|---|---|
| **发现时间** | 2026-06-05 |
| **发现方式** | 人工测试发布动态，选大图后提交报 500 |
| **严重程度** | P0（功能完全不可用） |
| **修复 commit** | `ce09f6b` fix: resolve moment image data truncation error |
| **负责人** | 曹潇月 |

### 问题现象

在动态广场点击发布，选择手机原图或较大的照片后，提交报后端 500 错误。查看后端日志：`Data too long for column 'image_data'`，数据库写入失败。选择小图（< 100KB）时可正常发布，大图必现。

### 根因分析

数据库 `moment_images.image_data` 字段类型为 `VARCHAR(2048)`，最多容纳约 2048 个字符。前端将图片读取为 base64 Data URL 后直接提交，一张 1MB 的图片 base64 编码后约 1.3MB（约 130 万字符），远超字段长度上限，MySQL 直接拒绝写入。后端实体 `MomentImage.java` 已标注 `@Lob + MEDIUMTEXT`，但数据库实际建表时使用了旧的 DDL 脚本，字段类型未同步。

### 修复方案

**前端**：在 `file.js` 中新增 `compressImageToDataUrl()` 函数，使用 Canvas API 将图片等比缩放至最长边 1200px，JPEG 质量 0.8，压缩后再提交，将绝大多数照片控制在 150KB 以内。

**数据库**：执行 DDL 变更将字段改为 MEDIUMTEXT（最大约 16MB），并新增 migration 脚本 `alter_moment_images_image_data.sql`：

```sql
ALTER TABLE moment_images
  MODIFY COLUMN image_data MEDIUMTEXT;
```

### 验证结果

- 选择 4MB 原图：前端压缩后约 120KB，提交成功，展示正常
- 选择小图：流程不变，正常发布
- CI 测试：无影响（单元测试不涉及图片 base64）

---

## Bug #6 — Railway 部署后验证码邮件无法发送

| 项 | 内容 |
|---|---|
| **发现时间** | 2026-06-06 |
| **发现方式** | 部署到 Railway 后注册/登录验证码功能不可用 |
| **严重程度** | P0（用户注册/登录流程阻断） |
| **修复 commit** | `526e4c5` fix: replace SMTP with Resend HTTP API to bypass Railway SMTP block |
| **负责人** | 曹潇月 |

### 问题现象

本地开发环境验证码邮件发送正常（Gmail SMTP 587 端口）；部署到 Railway 平台后，注册/登录时验证码始终无法到达，后端日志显示 SMTP 连接超时。尝试切换至 465 端口 SSL 同样失败。

### 根因分析

Railway 平台在网络层屏蔽了出站 SMTP 相关端口（25、465、587），所有通过 JavaMailSender 走 SMTP 协议的邮件发送请求在 TCP 层就被丢弃，无法建立连接。这是 Railway 的平台级限制，不是代码问题。

### 修复方案

将 `VerificationCodeService` 中的邮件发送从 JavaMailSender（SMTP 协议）改为调用 Resend HTTP API（HTTPS 443 端口，不受封锁），通过 `RestTemplate` 发送 POST 请求完成邮件投递。

```java
// 修复前：SMTP，Railway 封锁
javaMailSender.send(message);

// 修复后：Resend HTTP API，走 443 端口
restTemplate.postForEntity(RESEND_API_URL, payload, String.class);
```

### 验证结果

- Railway 环境注册：验证码邮件正常到达（约 3-5 秒）
- 本地开发：逻辑一致，无影响
- 邮件格式、发件人显示正常

---

## Bug #7 — 后端 H2 测试数据库缺少表结构，CI 多个测试失败

| 项 | 内容 |
|---|---|
| **发现时间** | 2026-06-06 |
| **发现方式** | CI 流水线 `backend_test` 阶段报错 |
| **严重程度** | P1（CI 阻塞，多个测试无法运行） |
| **修复 commit** | `539037d` fix backend test schema and add db sync patch |
| **负责人** | 王雯 |

### 问题现象

CI 流水线中多个测试用例抛出 `Table "CERTIFICATION" not found` / `Table "DISPUTES" not found` 异常，导致 `CertificationAccessTest`、`DisputeServiceTest` 等测试直接报错退出，与业务逻辑无关。

### 根因分析

测试环境使用 H2 内存数据库，需要 `schema-h2.sql` 在启动时初始化表结构。Phase 4 开发过程中新增了 `certification` 和 `disputes` 两张业务表，DDL 已写入 MySQL 生产脚本，但忘记同步更新 H2 测试 schema 文件，导致测试环境缺表。此外，测试配置 `application.yml` 中 datasource 配置项也需要补充对应的 schema 初始化路径。

### 修复方案

- 在 `backend/src/test/resources/schema-h2.sql` 中补充 `certification`、`disputes` 等新增表的建表语句（适配 H2 语法）
- 在 `backend/src/test/resources/application.yml` 中补充 `spring.sql.init.schema-locations` 配置
- 同步新增数据库同步 patch 脚本 `patch_camera_app_certification_disputes_sync.sql`，方便本地开发环境手动补表

### 验证结果

- CI 流水线重新触发：`backend_test` 绿灯，原来失败的 test 全部通过
- 本地 `mvn test`：全量测试无报错

---

## Bug #8 — 角色切换时 Navbar userId 被覆盖，修复后引入新问题被回退

| 项 | 内容 |
|---|---|
| **发现时间** | 2026-06-07 |
| **发现方式** | 人工测试切换摄影师/客户角色时个人中心异常 |
| **严重程度** | P1（功能性错误，但有回退记录） |
| **修复 commit** | `7a0c172` fix: preserve real user ID on role switch in Navbar |
| **回退 commit** | `ffd94d8` Revert: 该修复引入新问题，回退 |
| **负责人** | 曹潇月 |

### 问题现象

用户在 Navbar 切换角色（摄影师 ↔ 客户）时，`userId` 被错误地替换为角色字段的值，导致后续请求携带错误的用户 ID，个人中心、订单列表等页面数据错乱。

### 根因分析

Navbar 中角色切换逻辑更新了 context 中的某个字段时，误将 `userId` 字段也同步更新为 `role` 的值（字段混淆）。初次修复尝试通过在赋值时分离 `userId` 和 `role`，但修复方案本身在某些状态下导致角色切换后页面不刷新，引入新的交互问题。

### 处理结果

初次修复被回退，暂时恢复到修复前状态。角色切换问题已在后续整体重构 `AuthContext` 时统一处理（不再在 Navbar 直接修改 userId），问题最终解决，但未单独留存 commit。

**经验教训**：对公共 context 的修改影响面广，应在隔离分支上充分测试后再合入，避免 fix-revert 来回。

---

## Bug #9 — 消息界面图片附件按钮可点击但实际不支持上传

| 项 | 内容 |
|---|---|
| **发现时间** | 2026-06-07 |
| **发现方式** | 前端代码审查 + 联调发现 |
| **严重程度** | P2（UI 欺骗用户，但功能本身为 P2） |
| **修复 commit** | `03b13f1` fix: make message image attachment entry truthful |
| **负责人** | 牛郝彦姝 |

### 问题现象

消息对话页面工具栏中有图片附件上传按钮，点击后打开文件选择器，选图后无任何反馈，图片未出现在消息中。用户不清楚操作是否成功。

### 根因分析

该按钮是早期占位实现，调用了一个尚未对接后端的 handler，选图事件被消费但无实际上传逻辑。消息模块本阶段的图片发送能力尚未交付（P2 功能），但按钮仍以可用状态展示，造成 UI 与能力不符。

### 修复方案

移除消息输入框工具栏中的图片附件按钮（`MessageToolbarButton` 相关代码），同步清理 `ConversationComposer` 和 `ConversationDetailPage` 中的占位 handler，确保当前展示的功能入口与实际可用能力完全对应。

### 验证结果

- 消息输入区域不再显示图片上传入口
- 工具栏其余功能（引用、发送）不受影响
- 构建通过，无遗留占位代码

---

## 二、修复汇总

| Bug # | 模块 | 严重程度 | 根因类型 | 是否涉及 AI 协助 |
|---|---|---|---|---|
| #1 价格单位传 NaN | 需求发布 | P0 | 工具函数边界缺失 | 是（AI 辅助生成修复） |
| #2 信用分变化方向错误 | 评价/信用 | P1 | 业务逻辑误解 | 是（AI 辅助）|
| #3 大厅头像不一致 | 大厅/用户 | P1 | 字段来源不统一 | 否 |
| #4 消息对方身份显示为自己 | 消息 | P1 | 参与者解析顺序假设错误 | 否 |
| #5 动态大图截断 | 动态广场 | P0 | 数据库字段长度过小 + 前端未压缩 | 是（AI 辅助）|
| #6 Railway 邮件无法发送 | 用户认证 | P0 | 部署平台封锁 SMTP 端口 | 是（AI 辅助） |
| #7 H2 测试 schema 缺表 | 测试/CI | P1 | 新表未同步到测试 DDL | 否 |
| #8 角色切换 userId 被覆盖 | 导航/认证 | P1 | 字段混淆 + 修复引入新问题 | 否 |
| #9 图片附件按钮欺骗用户 | 消息 | P2 | 占位实现未清理 | 否 |

---

## 三、共性经验

1. **单位转换务必做防御性处理**：`null` / 空字符串 / 非数字输入应有明确返回值，不能依赖外部调用方保证输入合法。
2. **数据库 DDL 变更必须同步测试 schema**：每次新增表或修改字段，需同步更新 `schema-h2.sql`，否则 CI 必然失败。
3. **占位功能不能以"可用"状态展示**：未完成的能力入口应隐藏或禁用，避免误导用户。
4. **部署环境差异要提前调研**：Railway 封锁 SMTP 是已知限制，应在选择邮件方案时提前确认，而非到部署时才发现。
5. **对公共 context / 全局状态的修改要在隔离环境充分验证**，Navbar 的 fix-revert 来回说明影响面评估不足。
