# Portra 单次生产发布清单 — GO（待最终生产变更授权）

日期：2026-11-05。GO 表示本次限定变更已可按下列唯一顺序执行，不表示生产已变更或备份已恢复验证。迁移前的真实备份恢复是强制执行闸门，失败即停止，不得凭 GO 跳过。

| 状态 | 结论 |
|---|---|
| DATABASE_MIGRATION_READY | 最小短信增量已固定；9 项新增隔离验证通过。生产执行前必须完成备份恢复闸门。 |
| HARMONY_APP_READY | App 提交 `fe64bd9a5ac5f64ffca3983a05543f97fa9b91f5`；保留 84 项、真实 HTTP 13 项和签名 HAP 成果。 |
| BACKEND_ONLY_READY | 已解除 CI 的 Web 发布联动；只发布批准的原 JAR，验证源码树/哈希，维护停机后可直接启动新 JAR。 |
| MAIN_RELEASE_READY | 发布分支 `codex/portra-backend-only-production` 基于最新远端 Main `2d4d5cbbbd03088648c1dc918b326d9239af4270`；后端与已验证候选完全相同，无 harmony/frontend 文件变更。 |

尚无未解决的代码或脚本失败。生产授权、可恢复备份、生产实际执行及 App 真机验收尚未发生，不能标记最终目标已达成。本次不重跑既有 952 项、App 84 项或 HTTP 13 项。

## 固定的提交与制品

- 已验证后端源提交：`44066e7eb2563d15f8ae8d32d3f97b3a099d52de`，分支 `codex/portra-backend-final-integration`；166 个既有文件一次性固定，未重新整合。
- 发布分支中原样纳入的后端提交：`452493b3`。最终完整发布 Commit 由本清单所在发布分支 HEAD 固定；随交付的外部 `final-release.json` 记录完整值及文件清单。
- 鸿蒙 App 独立提交：`fe64bd9a5ac5f64ffca3983a05543f97fa9b91f5`，分支 `feature/harmony-c-ui-polish`；仅 9 个 challengeId 文件/测试。其他既有未提交 UI 改动保留，不进入 Main。
- JAR：`D:/software/Camera/output/portra-backend-final-candidate/backend/target/camera-0.0.1-SNAPSHOT.jar`。
- **JAR SHA256：`c855e73e0a5a579a910e3d266d2a3c9dfbac6bf71440be37cc38e532ab1432b3`**。
- HAP：`D:/software/Camera/harmony/entry/build/staging/outputs/staging/entry-staging-signed.hap`。
- HAP SHA256：`d83085974ebe3a5dab551e1fb5436e4a1b1843ac861d4c4331370fbb28273850`。
- `backend-build.json` 绑定原后端 Commit、后端 Git tree、JAR 哈希及 952 PASS / 0 FAIL / 2 SKIP。发布只取这个原始制品，不重建候选。

## 唯一数据库增量

依据负责人提供的 ECS 报告 `/var/tmp/portra-production-schema.FCR03a/schema-report.tsv`（该文件在 ECS，不在 Windows）：MySQL 8.0.46；8080 使用 `portra_staging`，43 表；Integration 为 44 表。已比较的其他字段/索引没有差异报告。本轮不重新执行该全库对照。

复用既有迁移链路的 `V20261103__sms_challenge_binding.sql`，原文件 SHA256 `6aa039ad8923a8cef41463c5647ec4b3f832759f0a9240c0471dec7d88ed3f8f`。生产脚本为 `infra/production/sms-challenge-portra-staging.sql`，DDL 仅把数据库限定名替换为 `portra_staging`；没有其他业务表变更。

| 对象 | 完整定义及兼容性 |
|---|---|
| sms_challenges.challenge_id | VARCHAR(36) NULL，隐式 DEFAULT NULL |
| owner_user_id | BIGINT NULL，隐式 DEFAULT NULL |
| owner_session_id | VARCHAR(128) NULL，隐式 DEFAULT NULL |
| operation | VARCHAR(32) NULL，隐式 DEFAULT NULL |
| invalidated_at | DATETIME(6) NULL，隐式 DEFAULT NULL |
| uk_sms_challenge_id | UNIQUE BTREE(challenge_id)，完整列、无前缀、单列索引；NULL 可共存，非 NULL 不可重复 |
| sms_challenge_locks | InnoDB；lock_key VARCHAR(64) NOT NULL，无显式默认值；PRIMARY KEY BTREE(lock_key)，完整列、无前缀；字符集/排序规则按原脚本继承目标库 |

旧短信行不 UPDATE、不 DELETE，五个新列保持 NULL。新后端拒绝消费没有 challengeId 的旧挑战；切换后需重新获取短信验证码，不将旧记录伪造成有效新挑战。

脚本只有一次 ALTER TABLE 和一次 CREATE TABLE，**不是幂等迁移**。MySQL DDL 隐式提交：ALTER 成功而 CREATE 失败时属部分应用，必须停在现场；禁止整文件重跑或 DROP 已完成对象。只读 `check-sms-migration.py` 在迁移前拒绝已应用/部分应用，在迁移后核对列、默认值、两项完整索引、引擎和旧短信行数。它仅检查两张短信表，不重新审计整个数据库。

新增隔离验证使用本地 MySQL 8.0.41、独立 datadir、仅 shared-memory、禁用 TCP；9 项通过，包括 DDL 同源、旧行保留、重复键拒绝、重复执行/部分应用停止。没有连接或改动生产 MySQL 8.0.46。

## GitHub 实际触发链已核实

- 仓库 `yueyue0218/Camera` 实际只有两个工作流：Project CI（ID `255138379`）与 Deploy Portra staging（ID `295385714`），均 active。
- 远端 Main 的 CI 在 Main push 成功后通过 `workflow_call` 调用 `deploy.yml`，旧实现会构建并上传 Web 与后端；没有独立 `workflow_run` 第三条触发链。
- Main 运行 `41004134696` 的实际 jobs 包含成功的 `Deploy successful main SHA to staging / Plan and deploy staging`，不是仅凭 YAML 推断。
- 实际部署变量：`STAGING_HOST=47.76.106.57`、端口 22、用户 portra-deploy；公开 URL 为 `https://47.76.106.57/`。旧健康检查使用 `/service-packages?page=1&size=1`。
- 全部分页运行列表未发现未结束任务。Main 当前无分支保护，仓库无 rulesets；Main HEAD 仍为上述 `2d4d5cbb...`。
- 已有 repo secrets `STAGING_SSH_PRIVATE_KEY`、`STAGING_KNOWN_HOSTS` 可复用，未读取 secret 值。现有 staging 环境没有 reviewer 规则。新流水线复用该连接，但**不把环境名称当作审批**：显式开关、完整 SHA、JAR/manifest 哈希以及 root-owned 审批凭据共同放行。
- 本轮未更改 GitHub 工作流状态、变量、secret 或环境。发布时仍需按下一节先停触发器再合并；之前查到无活动任务不替代执行时清空队列。

## 一次性生产发布执行清单（授权后严格顺序）

1. **封锁旧自动部署。** 冻结其他发布操作；关闭两个 workflow，设置 `PRODUCTION_BACKEND_ENABLED=false`。取消并等待所有旧提交的 queued/waiting/in_progress/pending 运行结束，再确认 Main 仍为 `2d4d5cbb...`。不能仅删除新 YAML 中的 Web 步骤就假设旧运行消失。

   ```powershell
   gh workflow disable 255138379 --repo yueyue0218/Camera
   gh workflow disable 295385714 --repo yueyue0218/Camera
   gh variable set PRODUCTION_BACKEND_ENABLED --body false --repo yueyue0218/Camera
   # 对实际未结束的旧运行逐个：gh run cancel <ID> --repo yueyue0218/Camera
   # 确认已结束后才能继续；不取消其他项目运行。
   ```

2. **维护停机、备份、恢复核验。** 经现有授权 root 运维会话执行 `systemctl stop portra-backend.service` 并确认 inactive / MainPID=0；不先迁移再停旧写入者。使用现有 DBA 凭据备份 `portra_staging`，保留 routines/events/triggers、二进制字段和完整数据；备份上传目录 `/opt/portra/uploads`，记录原 JAR、Web 目录目标与全资产哈希。备份目录必须权限受限，文件记录 SHA256。不得把凭据打印到日志。

   ```bash
   # DBA_CNF 为现有授权连接的受保护配置，BACKUP_DIR 为本次私有备份目录。
   set -Eeuo pipefail
   umask 077
   mysqldump --defaults-file="$DBA_CNF" --no-login-paths --single-transaction \
     --routines --events --triggers --hex-blob --set-gtid-purged=OFF \
     portra_staging > "$BACKUP_DIR/portra_staging.sql"
   tar -C /opt/portra -cpf "$BACKUP_DIR/uploads.tar" uploads
   sha256sum "$BACKUP_DIR/portra_staging.sql" "$BACKUP_DIR/uploads.tar" > "$BACKUP_DIR/SHA256SUMS"
   ```

   **必须把该次 SQL 备份恢复到与生产隔离的 MySQL 恢复实例并验证成功**，核对 43 表结构、全部表行数和关键业务记录；上传归档在隔离目录恢复并核对文件哈希。恢复实例 UUID 必须不同于生产，不能向 `portra_staging` 原实例导入备份作为演练。记录备份路径/哈希、恢复实例身份、恢复命令退出码及比对结果。未成功恢复、磁盘不足、备份不完整或发现其他写入者：停止，不执行 DDL、不合并 Main。这里只要求本次可恢复备份，不重新设计原迁移链路。

3. **只应用短信增量。** 将固定脚本放入本次私有操作目录并核对交付 SHA256。保持旧服务停止。先运行两表只读前置检查；通过后执行 SQL；最后运行只读后置检查。任一步非零即停止，保留 stdout/stderr 和部分结构；不使用 `--force`。

   ```bash
   python3 check-sms-migration.py --defaults-file "$DBA_CNF" --phase before > sms-before.json
   mysql --defaults-file="$DBA_CNF" --no-login-paths --database=portra_staging \
     --batch --raw --skip-force --skip-reconnect --local-infile=0 --init-command='' \
     < sms-challenge-portra-staging.sql > sms-migration.log 2>&1
   python3 check-sms-migration.py --defaults-file "$DBA_CNF" --phase after \
     --before-report sms-before.json > sms-after.json
   ```

   确认变更仅上述两张短信表、43→44 表、旧短信记录数不变。完整成功后才继续。半迁移不启动旧/新服务；由同一获批窗口根据实际已完成对象确认缺失 DDL，不盲目重跑。任何超出上述增量的变更另行停止确认。

4. **一次快进 Main，不能先推后端再推流水线。** 使用最终完整发布 SHA，先以非强制 push 保存发布分支；确认远端 Main 未移动，再将完整发布 SHA 非强制快进到 Main。该提交集合同时包含后端、替换后的 CI 和 Backend-only deploy.yml，无 App/UI/Web 代码。两个工作流仍 disabled、开关仍 false，所以合并不会抢先部署。若 Main 已移动，停止；不重置/强推 Main，不自动再整合后端。

   ```powershell
   # 在本地发布工作树，RELEASE_SHA 为本次固定交付 SHA。
   git push origin codex/portra-backend-only-production
   git ls-remote origin refs/heads/main
   git push origin "${RELEASE_SHA}:refs/heads/main"
   ```

5. **投递已测试 JAR并放行唯一 Backend-only run。** 上传原 JAR（命名 backend.jar）与 `docs/production/backend-build.json` 到 `/home/portra-deploy/incoming/<RELEASE_SHA>/`；不上传 frontend、dist、Nginx、上传目录或其他数据。核对本地/远端哈希一致。由获批 root 创建 `/etc/portra/releases/<RELEASE_SHA>.json`，绑定此 SHA、JAR、旧 JAR 哈希、主机、有效期、生产数据库身份、备份恢复证据及增量成功证据；`initialServiceState=inactive`。根目录链 root 所有且部署用户不可写，审批文件对部署账号可读。旧 Main 不默认为兼容回退，`previousJarCompatibleAfterMigration=false`。

   设置 `PRODUCTION_BACKEND_APPROVED_SHA=<RELEASE_SHA>`、`PRODUCTION_BACKEND_APPROVED_JAR_SHA256=c855e73e...`、`PRODUCTION_BACKEND_MANIFEST_SHA256=<交付 manifest 哈希>`，最后设置 `PRODUCTION_BACKEND_ENABLED=true`。只启用已替换的 workflow `295385714`，手动 dispatch 一次 Main。CI 暂不启用，避免重跑既有整套测试。新 prepare 只读取暂存的已验证制品，检查原 JAR 哈希、manifest 哈希、当前 Main 的 backend tree 及关键类，再通过 artifact 传给激活 job；不重新构建。

   ```powershell
   gh workflow enable 295385714 --repo yueyue0218/Camera
   gh workflow run deploy.yml --ref main --repo yueyue0218/Camera
   # 记录此次 run ID；只跟踪它，不重复 dispatch。
   ```

6. **8080 和 App 验收。** 自动激活检查新 JVM PID、JAR 路径/哈希、本地 8080 和实际 HTTPS 只读业务返回；健康地址在 root 凭据中使用实际 `/demands` 或已确认的无查询参数公开路由，不使用不存在的 `/health`。新前后 Web 全资产哈希及链接目标必须完全一致；旧上传文件逐项保留，数据库不得清空。任何失败立即使流水线失败；不能把 `BACKEND_HEALTH_PASS_APP_ACCEPTANCE_PENDING` 当成最终验收。

   安装交付 HAP 到指定验收设备，确认实际 API 地址指向该 ECS 8080 路由；使用获批验收账号完成真实短信登录与授权、图片上传/查看、大厅查询、动态发布/刷新、两账号消息收发、订单相关流程。退出重进及重启 App 后再次读取，确认数据持久化。短信验证码由用户/验收人输入，不记录到交付日志。记录设备/HAP 哈希、8080发布 SHA/JAR哈希、每项操作结果和持久化证据。

   **失败恢复：**停止后续验收/分支同步，保留本次 evidence；root 运维执行 `systemctl stop portra-backend.service`，保留当前数据和新增结构。只有已有回滚方案确认支持 challengeId、隐私与当前结构的 JAR 才能回切；不得盲目恢复旧 Main 或删除新增列/表。备份不是默认允许覆盖当前数据的许可。只处理实际失败，不扩展审计范围。

7. **同步并关闭发布窗口。** 上述全部通过后，从远端最新 Main 将 `backend/` 原样同步到 `feature/harmony-c-ui-polish`；不覆盖其 App 提交或其他 UI 改动。同步前如开发分支 backend 存在本地修改，先保存独立补丁再对齐，不静默丢失。显式 `git add -- backend` 后提交同步结果，核对两分支 `git rev-parse <ref>:backend` 完全相同；最终运行 JAR 必须仍为本清单哈希。设置 `PRODUCTION_BACKEND_ENABLED=false` 后再启用 Project CI。新 CI 发布路径仍有完整 SHA 与显式开关，未来不能联动覆盖 Web。保存最终 `BACKEND_ALIGNED_AND_DEPLOYED + APP_CORE_FUNCTIONS_PASS` 证据后结束。

本清单所有远端写入、服务停机、备份/恢复演练、迁移、Main 推送及设备验收均等待同一次最终授权；本轮只完成本地整理及必要增量验证。
