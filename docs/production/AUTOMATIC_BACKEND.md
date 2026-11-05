# 合并 main 后自动部署后端

新增 `.github/workflows/auto-backend.yml` 独立于暂停的 `Project CI` 和旧的
`Deploy approved backend only`。PR 只做检查；合并到 main 后，在 Java 17 上执行
`mvn verify`（包括测试、覆盖率门槛和打包），把同一个 JAR 封存后传到 ECS。
不构建或部署 Web，不执行数据库迁移，不修改 Nginx、systemd 或 sudoers。

## 启用一次

1. 通过 PR 合并本次修改。保留 main 的 PR、审核、禁止强推和删除规则。
   此时缺少新的自动部署开关，只会测试，不会激活后端。
2. 在 ECS root 终端取得**已审核的提交**中的这三个文件，放到独立目录：
   `infra/production/automatic_backend.py`、`deploy-backend.py` 和
   `enable-automatic-backend.py`。例如（将 SHA 改成实际已审核的完整提交）：

   ```bash
   (
     set -eu
     revision='<已审核的完整提交SHA>'
     install -d -m 700 /root/portra-auto-setup
     cd /root/portra-auto-setup
     for file in automatic_backend.py deploy-backend.py enable-automatic-backend.py; do
       curl --fail --silent --show-error --location \
         "https://raw.githubusercontent.com/yueyue0218/Camera/$revision/infra/production/$file" \
         -o "$file"
     done
     python3 enable-automatic-backend.py --enable
   )
   ```

   这是 root 对后续应用发布的持续授权。安装器确认当前 JAR 与已有 root 审批
   完全一致，复用已审核的数据库身份/备份证据，检查本地和公网 HTTPS 健康。
   它不会补造缺失的审批或把 false 改为 true；缺少证据时停止，由维护者核实。
   策略写入 `/etc/portra/automatic-backend.json`，root 所有、部署组只读。
   不会改动现有策略；重复安装前须由 root 备份、审核后更新。
3. GitHub **Settings → Secrets and variables → Actions → Variables**：
   新增 `PRODUCTION_BACKEND_AUTOMATIC_ENABLED=true`，保留已有
   `PRODUCTION_BACKEND_ENABLED=true`。现有 `STAGING_HOST`、SSH 密钥和 known_hosts
   继续使用，不新增或输出凭据。`staging` Environment 若另有审批规则，仍会等待。
4. 首次验证可在 PR 中修改本文件的说明并合并，观察
   **Backend CI and automatic deployment**。涉及 backend、发布脚本或该 workflow
   的 main push 会触发，纯前端变更不触发。PR 的构建任务不会取得部署密钥。
   原固定 SHA/JAR/manifest 变量仅供旧手动流程使用，无需每次更新。

## 发布边界和失败处理

- 每次部署前确认提交仍是最新 main，过时的运行跳过；服务器文件锁串行化激活。
- 制品 SHA256 在打包、上传、远端激活时核验，严格校验 SSH 主机密钥和 HTTPS。
- 自动策略固定数据库映射类、SQL、配置、mapper XML、结构初始化器和依赖版本的
  指纹。这些内容变化会停止发布，要求维护者完成兼容性、迁移和备份审查后更新
  授权。此机制是保守的变更检测，不能证明任意业务代码没有数据语义变更；这仍
  由 PR 审核负责。不要仅复制新指纹来跳过审查。
- 验证新 JVM PID、JAR 路径/哈希、本地和公网业务响应，以及 Web 和已有上传文件
  保留情况。健康通过不等于短信、消息、订单或鸿蒙真机全功能验收通过。
- 新生成的上传文件增加存储组读取权限；不增加组写权限，派生图不会增加其他
  用户读取权限。已有不可读文件仍需按此前 ACL 方式单独授权部署账号。
- 只重跑失败的 deploy 会继续使用成功 build 封存的同一制品。已部署且哈希一致
  时仅检查健康，不重启 JVM。重跑全部 job 会重新构建，若同一提交产生不同 JAR
  会被不可变发布检查拒绝，不会覆盖现有版本；用新提交发布，或复用原制品。
- 健康失败使工作流失败并保留日志。默认**不假定旧版本兼容而自动回滚**；运维在
  明确确认后，可在首次授权时额外传入 `--allow-compatible-rollback`，只授权恢复
  上一个同结构版本。需要修改数据语义的发布必须另行审查，不能依赖结构指纹。
- 首次 GitHub/ECS 端到端运行成功前，不能把本地测试结果当成线上自动部署验收。

## 暂停

把 `PRODUCTION_BACKEND_AUTOMATIC_ENABLED` 改为 `false` 可停止后续自动部署，
不停止现有后端。紧急时也可由 root 将策略中的 `enabled` 改为 false。
已开始的部署不受 GitHub 变量变更追溯影响，应先查看当前运行再操作。

## 已有 v1 授权升级：Windows/Linux 换行差异

v1 直接比较资源原始字节，会把 Windows CRLF 和 Linux LF 的差异当成结构变化。
v2 只对 SQL、YAML、properties、XML 文本资源把 CRLF 转为 LF，其余空白、内容、
单独 CR、class 字节码和依赖名称仍保持原样比较。新的资源 Git 属性也固定为 LF。
没有版本字段的既有策略继续使用 v1，绝不自动接受新的不同指纹。

遇到这一问题，先比较新旧 JAR，确认只是换行差异。合并修复 PR 后，由 root 用
该修复的已审核完整提交替换下面的 SHA，执行一次：

```bash
(
  set -eu
  revision='<已审核的修复提交完整SHA>'
  setup_dir=$(mktemp -d /root/portra-auto-upgrade.XXXXXX)
  cd "$setup_dir"
  for file in automatic_backend.py deploy-backend.py enable-automatic-backend.py; do
    curl --fail --silent --show-error --location \
      "https://raw.githubusercontent.com/yueyue0218/Camera/$revision/infra/production/$file" \
      -o "$file"
  done
  python3 enable-automatic-backend.py --upgrade-fingerprint
)
```

升级工具持有与部署相同的服务器锁，先确认原授权仍匹配**当前线上 JAR**并验证
健康，绝不从 incoming 的待发布 JAR 生成新授权。它在 `/etc/portra/` 创建 root
专用的 `automatic-backend.v1-*.json` 备份，只原子更新 `schemaFingerprint` 与
`schemaFingerprintVersion`，保留权限、回滚设置和其余审批字段，不重启后端。
版本已升级、当前版本不再匹配、锁被占用或健康失败时均停止，不要删除授权来
绕过检查。完成后只重跑**最新 main** 对应运行的失败 deploy job，复用其已封存
制品；旧提交运行会因为 main 已更新而跳过。

## 本地验证

```bash
python3 infra/production/test_release.py
python3 infra/production/test_automatic_backend.py
cd backend
bash mvnw -B verify
```

部署机上的脚本兼容 Python 3.6；开发与 CI 使用 Java 17。
