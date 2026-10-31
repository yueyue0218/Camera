# Portra P0 个人信息权利 / 授权 / 注销运营依据

本文件描述本轮代码能力，不等于数据库已迁移、后端已部署、设备验收或华为审核通过。不得在生产环境自动执行。

## API 与受理方式

所有接口采用现有 `Result {code,message,data}` 包装；只有 code=200 才成功。服务端使用当前认证账号，不能通过body指定他人userId。

- `GET /privacy/consent` 查询当前账号最新决定；无记录返回NOT_RECORDED。
- `PUT /privacy/consent`：`{status:"GRANTED"|"WITHDRAWN",privacyPolicyVersion:"2026-10-29-v1",crossBorderConsentVersion:"2026-10-29-v1",installationId:"安装实例标识",acceptedAtEpochMs:毫秒时间}`。
- `POST /privacy/rights`：`{type:"ACCESS"|"COPY"|"CORRECT"|"DELETE",description:"说明",idempotencyKey:"16至64位字母数字下划线或连字符"}`。同账号同key重试返回原申请；内容不同则40901。
- `GET /privacy/rights?page=1&size=20`：本人申请，data为`{records,page,size,total}`。
- `GET /admin/privacy-rights?status=SUBMITTED&page=1&size=20`：只允许真实ADMIN绑定运营账号。
- `PATCH /admin/privacy-rights/{id}`：`{status:"PROCESSING",resolutionNote:"已受理，正在核验身份及处理范围"}`。
- 完成人工处理后：`{status:"COMPLETED",resolutionNote:"实际已完成的处理及受限保留项目",verifiedIdentity:true,verificationNote:"核验方式、工单证据和处理范围引用，不填写身份证原文"}`。必须先受理为PROCESSING，不能从SUBMITTED直接标完成。
- 拒绝：`{status:"REJECTED",resolutionNote:"具体且合理的拒绝理由"}`；结果与操作者进入真实数据库及既有admin审计记录。

上述运营API可用现有经授权的API客户端调用，列表按SUBMITTED筛选即为工作队列；本轮没有新增管理后台Web页面。运营每天检查队列及即将到期记录。`responseDueAt`设为提交后15个自然日的内部响应目标，运营须按实际适用规则确认具体期限并在必要时提前响应，不能把该技术默认值当作法律意见。

DELETE只提交申请，绝不自动删除。受理者必须核验账号身份，检查图片、公开内容、其他参与者约拍/消息、举报证据及依法留存范围，完成实际处理后再记录结果。接口不会凭申请触发全库级联删除。导出/复制的具体内容与安全交付由运营人工核验并处理，不能在未交付时标完成。

## 自助注销

- `POST /privacy/account-closure/code`：`{phone:"本人绑定手机",deviceId:"安装实例标识"}`，服务端验证手机匹配，固定发送REAUTH用途验证码，继承已有限流/过期/尝试次数控制。
- `POST /privacy/account-closure`：`{phone:"本人绑定手机",code:"6位验证码",confirmed:true}`。
- 成功返回`{status:"CLOSED",closedAt,retainedDataNotice}`；账号转DELETED，资料匿名化、角色绑定移除、全部会话撤销，旧Access/Refresh失效；不是logout或申请状态。
- 未完成订单、未结争议、管理员角色未移除或短信失败会阻止完成。失败不显示成功。

复用既有注销cleanup：需求关闭并隐藏、橱窗下线隐藏、动态逻辑下线；文件改PRIVATE，停止匿名公开访问，原始文件和备份不做危险物理清除；关注/意向/动态交互/通知等本人辅助数据清理；身份认证记录移除；公开照片授权撤销；摄影师资料清空并停止接单。消息、约定、订单、评价、举报、审计及相关证据保留ID关联，继续沿用参与者/管理员权限，运营须另行确认保留期限、最小访问和到期物理清理。已分发浏览器/设备图片缓存不能由本次服务端事务远程回收。

注销验证码必须配置运营已批准的`camera.sms.reauth-template-id`。PNVS还必须配置与登录不同的`camera.sms.reauth-scheme-name`，以隔离验证码用途。未配置时失败关闭，不复用未批准的登录模板或跨用途云端验证码。本轮不改ECS配置、不发送真实短信、不部署。

## 撤回后的处理限制

撤回和事件记录、公开内容下线在同一数据库事务内；数据库失败整体回滚。不会删除账号、清空全部资料或伪造退出成功。服务端40302拒绝普通业务；必要的认证恢复、隐私状态、权利申请、注销渠道仍可使用。需求/橱窗关闭隐藏、公开动态隐藏、公开文件PRIVATE、个人可见字段关闭、停止接单；重新同意不擅自恢复公开内容，历史内容恢复需运营核实处理。

Native登录前必须携带`X-Portra-Consent-Version`、`X-Portra-Consent-Accepted-At`、`X-Portra-Installation-Id`本地显式决定证据。Native登录不会静默改写账号决定，登录后先读取/显式绑定。跨设备撤回后，另一设备在尚未获知远端撤回时仍可能发起必要的短信身份核验/登录请求（不能凭未验证手机号泄露账号授权状态）；认证后先同步服务端决定，普通业务继续阻断。不得据此声称远端撤回能取消所有已经发出的身份核验请求。带Harmony版本头的账号普通业务在NOT_RECORDED时40302；已有WITHDRAWN对所有客户端生效。历史Web客户端尚未接入首次同意流程，NOT_RECORDED的旧Web路径保持兼容，不能据此声称全平台新同意已上线。服务端决定与不可变事件保留账号/安装实例、类型、协议版本、时间与状态；未来超过5分钟的客户端时间拒绝。撤回后旧pending同意时间不晚于撤回时间不能重新授予，必须新显式操作。

服务端拦截请求开始时查状态；客户端应取消可取消并发请求。已经完成或不可撤回的处理不会伪装成已撤销，仍需依法核对保留与处理依据。不同业务在撤回前已通过鉴权的事务必须在部署前并发联调；本轮不声称全局分布式事务撤销。

## 上架仍待确认

新增迁移`add_privacy_rights_and_consent.sql`须在隔离库审核验证后按既有规范执行；无本次线上写入。回滚优先保留新增数据表及审计，替代版本仍须尊重WITHDRAWN，不得回到可绕过撤回的旧包。附件目标中的Release HAP、最终Production环境、签名与设备验收仍由最终集成流程确认。

真实境外接收方名称、联系方式、处理目的/方式/信息种类/权利渠道必须由运营核实。本轮不编造主体资料；个人信息保护影响评估、适用出境程序、供应商协议、保存期限及人工服务能力仍需实际落实。
