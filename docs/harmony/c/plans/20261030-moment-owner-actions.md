# 本人动态详情编辑删除实施计划（2026-10-30）

> 执行：沿用本轮用户明确要求，当前会话直接完成；TDD、最终独立审查、全套及模拟器真实验收。公共文件仍遵守维护者明确授权边界。

**目标/设计**：本人动态详情右上角三点菜单，编辑/删除；正文最多200字，标题50字，复用现有原生发布表单和完整详情相册，删除二次确认。保存使用真实PUT，删除真实DELETE；列表及详情以真实响应/重新GET为准。作者判定按后端authorId，不依赖作者role与当前role相同。
**方案**：复用MomentPublishPanel的编辑模式，新增C作者操作控制器，统一覆盖动态广场和通知进入的同一详情页；另建表单会重复图片适配与200字逻辑，故不采用。沿用共享认证HttpClient，不改后端。
**接口**：ApiService.updateMoment(id,payload:CreateMomentPayload,key?):Promise<MomentSummary>；deleteMoment(id,key?):Promise<void>；cancelMomentUpdate/CancelMomentDelete(id,key?):void。已有DTO足够，公共修改仅ApiService一个文件，先准备补丁和契约证明再索取对应授权。

## 文件职责

- C：MomentPublishController/Panel/ApiBinding，增加可选编辑目标并保留发布兼容；编辑前GET完整详情，不从Feed预览预填。MomentOwnerActions/Binding：身份核验、可编辑权限、删除确认、结果不明核实、实例取消与旧响应隔离。
- C：MomentDetailPanel：可选三点菜单回调；NotificationMomentPage：协调所有详情入口、清理表单、更新后重新GET，删除后返回并使共享Feed缓存失效。
- 公共：network/ApiService.ets：只增加上述4方法，需授权。
- 回归：moment-owner-api.test.cjs、moment-publish.test.cjs、moment-owner-actions.test.cjs；交付及shared-change-requests更新。

## 审查重点

旧账号/旧详情的success/catch/finally不得更改新页；非本人无菜单且不发写请求；超时/取消不能当作未写入或盲目重发；完整相册与mentions保留；跨页面实例取消独立；身份变化或退后台清旧表单；编辑后的原列表不能被旧缓存覆盖。

## 实施步骤

- [x] 真实PUT/DELETE认证及取消契约先红；准备仅ApiService候选补丁并核对兼容，取得公共维护者授权后应用。
- [x] 编辑复用发布表单：测试预填完整GET、50/200、1–9、同对象及作者响应校验、旧版本隔离；先红再实现编辑模式。
- [x] 作者菜单和删除：测试真实身份、确认取消、仅一次DELETE、关闭/切对象/账号变化、结果不明后的GET核实；先红再实现并接入统一详情。
- [x] 全套node --test，assembleHap；本地普通用户创建专用测试动态，模拟器详情编辑→GET验证、取消删除→仍存在、确认删除→404及列表消失、非本人无菜单。
- [x] 独立只读审查；记录命令退出码及设备证据，不把本地结果充作团队验收；准备Draft交付，未经本轮合并指示不自动合并。
Ruling：为保持真实导航/后台清理，最终菜单、编辑和确认在C详情内呈现，不使用系统内容覆盖层；视觉仍为手机菜单和悬浮确认卡片。
