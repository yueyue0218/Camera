# C剩余共享能力：已授权应用的最终交付包

2026-10-28，用户明确回复“已获 B 及公共维护者授权，应用整包并验收”，整包已应用至正式 C 独立工作区。基线60b6b02，integration仍b258ec8。此前155项候选结果已被正式162/162、严格举报24/24和设备证据取代。

[最终零上下文补丁](remaining-public-and-b.patch)包含原授权11个文件，[逐文件实际SHA256及授权状态](manifest.json)可核对。C作者回调和新增入口3项测试为C自有文件，另见PR差异。补丁在已应用工作区用下方反向检查；不要再次应用。

```powershell
git apply --reverse --check --unidiff-zero docs/harmony/c/proposals/remaining-owner-bundle/remaining-public-and-b.patch
```

授权文件：B ReportPanel、新ReportSubmissionStore、新B PublicProfilePage，公共ApiService/NavigationModels/NavigationPolicy/Index/PortraAppShell，report/public-profile/navigation三个测试。默认API参数与B只读MomentCard兼容。共享举报捕获真实对象、actor、sessionVersion、generation，响应/catch/finally均保护；换目标/身份清草稿，实例取消互不干扰。未知写入仅内存保留；同账号同目标切角色版本也不解锁重复提交，其他账号隔离；核实显示真实ID/状态/时间，不把历史相似记录自动当本次成功。

作者主页复用已有用户/角色和资料、动态接口，无新用户体系。动态去登录成功正常返回现有HALL(tab1)，已有栈顶HALL时复用；其他返回目标保持。root/HALL均有真实原生三路径证据，非调试路由。新增普通双角色仅用户另行授权的新隔离H2，不改线上或既有账号。

正式全套162/162、举报24/24、独立审查46/46，0TODO；assembleHap exit0，16.896秒。原生正常举报→Web下架/恢复闭环及真实写入后超时/关闭重开/切角色核实均已完成本地验收。详见[最终交付](../../c-module-delivery.md)和[证据](../../evidence/20261028-final/README.md)。PR25继续Draft；团队部署环境/实体签名验收未完成，不将本地unsigned包称为完整发布验收。
