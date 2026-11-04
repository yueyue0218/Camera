# C-SHARED-09：新公共认证与既有回归待维护者核定

公共来源1b14687/b42b2a8；公共实现及auth.test.cjs本轮未改。全套245/240pass/5fail，构建exit0；不得删除/跳过失败或擅自改认证掩盖。

目标均相对harmony/entry/src/main/ets；测试相对harmony/tests：

| 精确目标/接入位置 | 失败/建议签名和兼容要求 |
|---|---|
| auth/AuthTokenController.ets、AuthSessionManager.ets applyAuthenticated/restore；auth.test.cjs:160 | expected restored-access实际空；测试端口缺replaceAccessToken(token:string):void。维护者同步完整端口夹具，保留token同步断言，补旋转不增身份版本/不取消当前请求。 |
| AuthSessionManager.ets performRefresh/restore；auth.test.cjs:194 | credentialError为空，旧夹具未提供NativeSessionApi。核定无API恢复契约，以完整夹具验证LOAD/SAVE错误及存储失败不产生可用认证，不删安全断言。 |
| app/AppClient.ets restoreSession/restoreAndRelease；auth.test.cjs:209 | restoreStarted挡住显式失败后再试。建议restoreSession():Promise<void>保留并发合一，并恢复显式重试，或由维护者提供明确可调用重试入口；不并发旋转。 |
| AuthSessionManager.ets markExpired/clearStoredCredential；auth.test.cjs:251 | 第二次Promise在第一次清理未完成时提前成功。核定markExpired():Promise<boolean>共享清理结果；验证仅清一次、失败不被另一次提前成功掩盖、token立即失效和generation隔离。 |
| network/HttpClient.ets AuthenticationExpiredHandler/recoverSession；auth.test.cjs:268 | 旧夹具onExpired而新接口refreshSession():Promise<boolean>。维护者同步真实刷新夹具，保留401/40101/403，补并发401仅旋转一次、GET最多一次重试、POST/PUT/DELETE不重发。 |

不新建C认证/HttpClient。维护者提供修复提交或PR后重跑auth.test、全套、assembleHap及冷启动/断网恢复/切账号；仅更新夹具也需证明安全语义未放宽。保持A/B/C/D兼容，此交接不是公共认证实现修改授权。
