# 动态发布：公共维护者授权补丁

已核查：后端已有真实 POST /moments，Web MomentComposer已有；鸿蒙现有PublishPage发布的是约拍需求。ApiService缺动态创建，不能把需求发布当作动态。

仅请求2公共文件：model/ApiModels.ets增加CreateMomentPayload（title/content/imageDataList/mentions?）；network/ApiService.ets增加createMoment(payload,key?)和cancelMomentCreate(key?)，使用现有认证HttpClient。补丁owner-api.patch供逐行审阅，不改认证/TLS/路由/主题/B/D，不新建网络层，旧调用不变。

C接入：Feed“发布动态”进入手机表单；标题最多50、正文最多200、实际选择1至9图片；捕获会话及实例key，旧success/catch/finally不改新草稿。只用真实返回momentId确认成功；超时/取消提示核实，不自动重发。游客沿用已有登录。

验收：普通测试账号正常选图发布后列表GET查同momentId；切身份/关闭/重复点击/失败/超时行为；全套及构建如实记录公共auth既有5失败。新布局和入口已在模拟器展示，用户随后已明确要求检查、推送并合并到 integration/harmony-v1。

用户已明确确认公共维护者授权；2文件补丁已应用、构建成功。原先仅提案状态已解除。图库和设备真实POST仍待验收，不能声称完整发布验收。
归档补丁为零上下文格式，复核应用时使用 git apply --unidiff-zero --check；实际源代码已获授权并通过构建。
