# Portra 演示数据共享指南

本文档用于把本机演示订单、消息、报价、作品交付、作品展示授权和评价数据交给队友复现。不要把真实数据库 dump 或真实上传文件提交到仓库。

## 当前存储方式

- 默认数据库名：`camera_app`，见 `backend/src/main/resources/application.yml`。
- 上传文件：物理文件存放在本地目录，默认 `backend/uploads`；数据库 `files` 表只保存 `file_key`、文件名、MIME、大小、业务类型等元数据。
- 本地覆盖配置：`backend/src/main/resources/application-local.yml` 会覆盖数据库密码、邮件账号等敏感信息，该文件已被 `backend/.gitignore` 忽略，禁止共享。
- 订单演示链路主要涉及这些表：
  - 账号与身份：`users`、`user_role_bindings`、`provider_profiles`
  - 会话消息：`conversations`、`messages`、`conversation_hidden_by_user`
  - 报价与订单：`quotes`、`orders`、`order_status_logs`、`payment_records`
  - 交付与作品：`files`、`deliveries`、`delivery_files`
  - 授权：`photo_authorizations`、`photo_authorization_files`
  - 评价与信用：`reviews`、`review_complaints`、`credit_records`
  - 如果演示动态/主页也需要复现，还可能涉及 `moment_posts`、`moment_images`、`moment_likes`、`moment_favorites`、`user_follows`

## 方案 A：最快共享，整库导出

适合短期内部演示、队友需要完整复现你本机状态时使用。

导出前先确认没有真实隐私数据：

- 不包含真实邮箱、手机号、验证码、学生证照片、真实姓名、邮件授权码。
- `users.password_hash` 不应来自真实账号。
- `application-local.yml`、`.env`、数据库密码、邮件密码不要打包。
- 上传目录里不要包含真实用户照片；如果包含，只能脱敏或替换后再共享。

导出数据库：

```bash
mysqldump -u root -p --single-transaction --default-character-set=utf8mb4 camera_app > portra_demo_dump.sql
```

如果只想共享演示业务数据，可以先在临时库里脱敏，再从临时库导出。不要把 `portra_demo_dump.sql` commit 到仓库；建议通过私有网盘、内网传输或压缩包单独发送。

导出上传文件：

```bash
tar -czf portra_demo_uploads.tar.gz -C backend uploads
```

Windows PowerShell 也可以直接压缩：

```powershell
Compress-Archive -Path backend\uploads -DestinationPath portra_demo_uploads.zip -Force
```

队友导入：

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS camera_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p camera_app < portra_demo_dump.sql
```

恢复上传文件：

```bash
tar -xzf portra_demo_uploads.tar.gz -C backend
```

如果队友使用不同的 `file.storage.local-path`，需要把压缩包解到该配置对应目录，并保持 `files.file_key` 下的日期目录和文件名不变。

## 方案 B：更推荐，做可重复 demo seed

适合长期演示、多人协作、CI 或课堂展示。建议新建脱敏 seed，而不是直接共享整库：

```text
backend/src/main/resources/db/demo/portra_demo_seed.sql
```

seed 应该只包含虚构账号和虚构素材：

- 两个演示账号：客户、摄影师。
- 至少一组完整沟通：普通消息、报价、拒绝、重发、确认。
- 覆盖订单状态：待支付、已支付待拍摄、作品待确认、返修中、已完成、已取消或退款。
- 覆盖作品交付、作品展示授权申请、评价。
- 如果涉及图片，使用仓库允许提交的 demo 图片资源，或在文档里说明把图片放入 `backend/uploads/<date>/<fileKey>`。
- 禁止包含真实邮箱验证码、真实密码、真实身份证明、真实个人照片。

目前项目已有初始化/迁移顺序说明：`backend/src/main/resources/db/README_EXECUTION_ORDER.md`。新库应按该文档路径 A 执行；旧库补丁应按路径 B 执行。会话表缺 `order_id` 时，执行仓库已有的幂等脚本：

```bash
mysql -u root -p camera_app < backend/src/main/resources/db/conversations_messages.sql
```

该脚本会补齐 `conversations.order_id`、会话索引和 `conversation_hidden_by_user`，不清表、不删数据。

## 推荐协作流程

1. 临时演示：用方案 A，共享 `portra_demo_dump.sql` 和 `portra_demo_uploads.zip`，不要提交仓库。
2. 稳定演示：用方案 B，在单独 PR 里提交脱敏 seed 和 demo 图片说明。
3. 每次导入后先启动后端，再访问 `/messages`、`/orders`、`/profile` 检查是否白屏。
4. 如果 `/conversations` 报 `Unknown column 'order_id'`，先执行 `conversations_messages.sql`，不要在前端隐藏错误。

