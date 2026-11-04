# C-SHARED-11 本人动态编辑删除公共依赖

后端和Web已存在真实PUT /moments/{id}、DELETE /moments/{id}，后端按作者userId校验；最新集成3fa5e35的鸿蒙ApiService尚缺。候选和实际5项真实ApiService+HttpClient契约通过，仅OS传输mock；实际工作区新增测试先红（方法确实不存在）。

唯一公共文件：harmony/entry/src/main/ets/network/ApiService.ets。建议签名：updateMoment(id:number,payload:CreateMomentPayload,key?:string):Promise<MomentSummary>、deleteMoment(id:number,key?:string):Promise<void>、cancelMomentUpdate(id:number,key?:string):void、cancelMomentDelete(id:number,key?:string):void。沿用当前认证HttpClient、requireMomentId/requireMomentResult，复用现有DTO，不改认证/网络实现/后端。默认key含对象id；C按实例传key，A/B/C/D旧调用兼容。

补丁owner-api.patch为零上下文，git apply --unidiff-zero --check已通过，已获对应维护者明确授权并应用；实际5项接口契约通过。候选测试验证真实PUT/DELETE路径与Bearer、完整相册payload/响应、null删除成功、非法id不发请求、两个实例取消隔离、401/403/404不自动重发。

C接入：统一MomentDetailPanel本人三点菜单，复用原生发布表单编辑模式；NotificationMomentPage供所有详情入口共用。编辑先GET完整详情，保留图片及mentions、标题50正文200；捕获真实对象/当前session/version、旧success/catch/finally隔离。删除二次确认；结果不明GET核实，不假成功或盲目重发；成功使Feed缓存失效并以重新请求校验。验收：本人编辑→GET与列表一致、取消删除保留、确认删除后GET404/列表消失、非本人无菜单、关闭/账号变化/实例并发不串扰。
最终实现、287项回归和真实设备证据见 ../../evidence/20261030-owner-actions/README.md。
