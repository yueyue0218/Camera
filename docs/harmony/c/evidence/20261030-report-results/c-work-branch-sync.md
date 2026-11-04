# C工作分支安全同步：2026-10-30

用户明确要求把本人全部代码也推到feature/harmony-c-ui-polish，并明确禁止随意覆盖。采用正常Git合并保留双方历史，未使用force/reset/整文件选择一侧处理业务代码。

## 提交来源和保留证明

- 远端C起点：4646725ad491850722f7fbd1e39e92c33bb50475（队友报价/订单/交付、个人页/隐私、大厅/发布等核心已有提交）。
- 合入已交付举报：integration/harmony-v1的49e224dc97c4e18800a0ef8aac2c1ac72b7a45db（PR29）。
- 第一合并候选65a44a82df1e7af6101c5214d77fa75739688faa，无冲突；相对旧C只变动原举报PR的61个路径，无额外代码路径。公共ApiModels只增加ReportSummary四个可选字段，未覆盖其它DTO。
- 网络、认证、导航、Index、聊天/报价/订单/交付页面相对旧C没有差异；队友代码原样保留。旧C和举报集成均为合并候选祖先。
- 另保留原C本地举报源提交988bbefd269f9078a4a9531d982e7ef51b5cf18c历史，形成bd2114534c1c1a1263489008f6059a9e824a2917。只有4份重复交付说明冲突：3份新文档完整包含旧文档，另1份只修正原审阅补丁的基线/应用说明；逐项核对后保留已发布的新说明。其余文件无冲突，解决后整棵文件树与65a44a8完全一致。
- 因此动态发布/详情/点赞收藏/编辑删除、通知、信用、评价/申诉，以及最新举报结果/进度，和队友最新核心一起保留在C统一版本。

## 合并后的实际验证

- 现有完整鸿蒙测试：DEVECO_SDK_HOME设现有SDK，node --test展开全部harmony/tests/*.test.cjs，**421/421、0fail/skip/TODO、exit0**，9.955秒。[完整日志](c-sync-harmony-tests.txt)。
- 后端mvn -f backend/pom.xml test：JAVA_HOME=JDK17，JAVA_TOOL_OPTIONS只对本进程设java.io.tmpdir/jdk.net.unixdomain.tmpdir为既有短tmp目录；**848项，846通过、2项原有MySQL专项跳过、0fail/error、exit0**，3分55秒。[摘要](c-sync-backend-summary.txt)。
- 在harmony目录，NODE_HOME/DEVECO_SDK_HOME为现有DevEco路径，PORTRA_ENVIRONMENT=staging、PORTRA_BASE_URL=https://47.76.106.57，执行hvigorw.bat assembleHap --no-daemon -p product=staging：**exit0、46.802秒**。[日志](c-sync-assemble-staging.txt)。unsigned SHA256 **B20118BD38692395A929F94D2A0F5DC7D8315DFCF20738C40A3573C0AFD5F4B7**。构建通过不当作线上完整联调。

## 推送与环境边界

推送前重新fetch并验证当前远端C是本提交祖先，仅正常快进推送到feature/harmony-c-ui-polish；若队友同期新增提交则拒绝覆盖，重新合并验证。保留main与integration/harmony-v1，不在本轮把队友功能自动合入集成分支。

原C工作区若干净且可快进则正常同步；有未提交改动时不动它。没有重置、清理或自动stash。未自动替换用户正在测试验证码的模拟器安装包；当前新C包只是已完成构建，安装需后续明确操作。

此前真实Web页面审核→双方鸿蒙通知、禁用账号合法告知、实际MySQL迁移和历史数据审计仍未完成。分支统一不改变这些验收结论，也不自动部署后端。
