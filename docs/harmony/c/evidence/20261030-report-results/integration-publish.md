# 2026-10-30 举报独立集成验证

用户本轮明确要求提交、推送并合入integration/harmony-v1。原C分支远端4646725含其它尚未合入的订单/交付/个人页等工作，故未推送覆盖原工作分支；从真正集成基线449173a899c73745dae34d17446ee5a6aaeaae76建立codex/harmony-c-report-results-20261030，只移植举报源码、测试和证据。

原C举报源提交988bbefd269f9078a4a9531d982e7ef51b5cf18c；独立移植c6395e7。原C工作区保留，main和其它成员未提交文件未改。PR最终提交将包含本记录。

## 当前精确基线验证（不是旧混合分支数字）

- 鸿蒙全套node --test（PowerShell展开harmony/tests/*.test.cjs，DEVECO_SDK_HOME指向现有SDK）：**306/306、0fail/skip/TODO、exit0**，6.523秒，[完整日志](integration-harmony-tests.txt)。原394包括其它未合入功能的测试，本PR没有删除测试。
- 后端mvn -f backend/pom.xml test，JAVA_HOME=现有JDK17，JAVA_TOOL_OPTIONS仅本进程两个短tmp属性：**833项，831通过、2项原有MySQL专项跳过，0fail/error、exit0**，3分18秒，[逐类摘要](integration-backend-summary.txt)。测试输出包含的框架凭据未发布。
- 在harmony目录以NODE_HOME/DEVECO_SDK_HOME现有路径、PORTRA_ENVIRONMENT=dev、PORTRA_BASE_URL=http://127.0.0.1:18090执行hvigorw.bat assembleHap --no-daemon -p product=dev：**exit0、1分27.935秒**，[构建日志](integration-assemble.txt)。unsigned SHA256 **E6397B4D400B4F587C47FC37F46DC2C381BBED5D05D779F6A5F61D390F529E74**，不是发布签名或团队验收包。
- 单次独立审查及其重要隐私问题红→绿修复沿用原记录；独立移植未变更举报业务实现。本人原生举报/精确进度的既有设备证据按原阶段1库保留，不冒称此新包新增设备联调。
- 实际PR中未包含frontend、auth、network、Index或订单/交付新增文件。提交证据经手机号、真实JWT、私钥和临时管理员密码扫描，未发现这些敏感内容。统一补丁文件的空白上下文为合法格式，另用可逆应用核对，未为消除格式检查破坏补丁。

## 合入后的验证边界与数据库步骤

合入按用户本轮明确授权执行，**不等于完整C或真实Web闭环已验收**。尚待同库Web页面正常登录审核→双方鸿蒙正确通知、禁用账号合法告知可达性、实际MySQL迁移、历史治理原因/信用来源审计和Feed超大响应能力。

部署后端前先由数据库维护者执行backend/src/main/resources/db/migration/add_report_result_feedback.sql；fresh-init在add_admin_governance.sql已含字段。不自动执行共享库迁移、部署、补历史通知或清洗历史内容。

原审阅owner-backend.patch/owner-dto.patch按原C基线6d05318保留授权来源；当前集成PR以449173a为基线的实际diff为准，不要在当前树重复应用原补丁。
