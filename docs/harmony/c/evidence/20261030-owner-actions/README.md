# 本人动态编辑、删除真实验收（2026-10-30）

基线 integration/harmony-v1 3fa5e35；本轮用户明确授权公共网络维护者范围内的 ApiService 一个文件，并要求检查后推送、合并到 integration/harmony-v1。

行为：本人详情右上角三点，菜单“编辑/删除”；以真实currentSession.userId匹配authorId，当前身份role不同时仍允许本人操作。非本人无管理入口，后端真实PUT/DELETE均拒绝越权。菜单、编辑、删除确认在C详情内部原生布局呈现，实际导航离开和退后台仍关闭并清理表单，不修改全局导航/认证。

编辑复用MomentPublishPanel/Controller：先GET完整详情，预填标题/正文/全部图片和mentions，标题50、正文200字；旧长正文不在载入时截断，调整至限额后可保存。真实PUT /moments/{id}以服务器响应及随后GET更新详情；Feed仅保留前三张预览。新增照片复用既有选择与压缩，原发布默认行为兼容。图库新增照片选择未在本轮单独设备验收；已有图片保留/移除及文字修改已完成真实保存读回。

删除二次确认，取消不发DELETE；确认使用真实DELETE /moments/{id}，成功关闭详情、清缓存并重新读取列表。实例key、对象/账号/视图版本覆盖success/catch/finally；关闭页面只取消本实例。超时/取消不视为未写入，保留未确认状态，显式GET核实后再由用户操作，不自动重发。后端作者GET已删动态返回200/status=DELETED，普通他人GET404；C已同时处理，不把DELETED重现为旧详情。

最后按用户反馈将确认改为圆角24、两侧16留白的悬浮卡片；顶部22 + 把手后26留白，左对齐说明、按钮上间距28、按钮高50。模拟器保留专用动态4的新确认界面供查看，不替用户确认删除。

## 修改文件

- 已授权公共：harmony/entry/src/main/ets/network/ApiService.ets，增加updateMoment/deleteMoment/cancelMomentUpdate/cancelMomentDelete；复用CreateMomentPayload及原HttpClient，不改DTO、后端或认证。
- C：MomentOwnerActions.ets、MomentOwnerAttempts.ets；MomentPublishController.ets、MomentPublishPanel.ets、MomentPublishApiBinding.ets；MomentDetailPanel.ets、MomentInteractions.ets、MomentFeedModels.ets；pages/NotificationMomentPage.ets。此统一详情覆盖广场和通知入口。其余A/B/D、主题、公共图片组件未修改。
- 回归：moment-owner-api.test.cjs、moment-owner-actions.test.cjs、moment-publish.test.cjs、moment-interactions.test.cjs、notification-moment-binding.test.cjs。
- C计划、公共依赖交接、c-module-delivery及本目录证据。

## 实际验证

在仓库根目录设置DEVECO_SDK_HOME=C:/Program Files/Huawei/DevEco Studio/sdk：

    $cTests = @(Get-ChildItem harmony/tests -Filter '*.test.cjs' | ForEach-Object FullName)
    & 'C:/Program Files/Huawei/DevEco Studio/tools/node/node.exe' --test @cTests

全套287/287，0fail/skip/TODO，exit0，full-tests.txt。原发布、生命周期、举报、点赞收藏回归保留。新增接口先红后绿，作者DELETED及内联表单真实切页清理先红后修；独立只读审查发现的DELETED问题已修复并补回归，未再发现其它明确阻断项。

在harmony目录设置NODE_HOME=DevEco tools/node、DEVECO_SDK_HOME=DevEco sdk、PORTRA_ENVIRONMENT=dev、PORTRA_BASE_URL=http://127.0.0.1:18090：

    & 'C:/Program Files/Huawei/DevEco Studio/tools/hvigor/bin/hvigorw.bat' assembleHap --no-daemon -p product=dev

exit0，17.809秒，build.txt。保留原有图片packing弃用/异常处理及未配置签名警告。最终unsigned/dev HAP SHA256：D187FC960EA3DE88CF71D9FB8F8BDDE34821D55A75CD11DEE6FD22F2A2CAFC55。最终包已安装Mate 90 Pro、HarmonyOS7/API26、1280×2832模拟器。

真实链路使用授权本地隔离H2：http://127.0.0.1:18090，来源为既有本地fixture进程参数及本轮HAP构建变量，已实际连通；不是团队已确认staging。普通actorId=1、peerId=2，正常随机短信登录，未创建管理员/绕验证码/操作正式内容。专用动态3完成：

1. 详情完整相册原有5张；用户体验移除1张后，授权继续自动验收。原生“保存修改”提交测试正文及4张，随后认证GET确认正文、4张完整图片、原mentions；Feed真实GET仍3张预览（verify-edit.json、device-edit-saved.md）。
2. 点删除后取消，真实GET仍为已发布对象、正文与4张均保留（verify-cancel.json、device-delete-cancelled.md）。
3. 再确认删除，作者GET为DELETED、peer GET404、真实列表不含动态3且保留他人动态2；模拟器自动返回刷新后的Feed（verify-delete.json、device-delete-result.md）。

这些是实际Harmony UI及本地后端读回，Node逻辑回归单独记录，不作为设备导航证据。之前整个C模块的其它未验事项（团队环境跨端链路、签名/实体机等）仍按原文档保留，不因本次功能完成而宣称全部完成。