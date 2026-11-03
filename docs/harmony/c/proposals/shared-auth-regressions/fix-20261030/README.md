# C-SHARED-09 认证失败修复，2026-10-30

已获用户确认的公共认证维护者授权，3文件修复已正式应用。基线 integration/harmony-v1 的 8d79a015968ac661a8cf34c9dbdb8cfb3b6df9b2。原PR26的5项失败记录保留为当时事实；本轮最终全套268/268通过。

## 文件、行为与兼容

- harmony/entry/src/main/ets/app/AppClient.ets：restoreSession():Promise<void> 保留；并发合一、已认证不重复恢复。失败后在相同身份版本重试，保留已轮转但尚未持久化的凭据；退出、登录或过期改变版本后不能恢复旧账号。
- harmony/entry/src/main/ets/auth/AuthSessionManager.ets：同版本恢复重试重新进入RESTORING并清旧存储错误；刷新返回401仍正确过期删除。markExpired():Promise<boolean> 共享同一次实际清理结果，失败保持false；新身份清除旧Promise，保留立即清空bearer、Asset队列和版本保护。
- harmony/tests/auth.test.cjs：同步完整replaceAccessToken、NativeSessionApi、refreshSession及HTTP方法枚举夹具，保留跨环境、token同步、存储错误和401/40101/403断言。新增8项：并发删除失败结果一致、旧清理不影响新身份、并发GET单次旋转、POST/PUT/DELETE/PATCH不重发、保存失败不重发已消费refresh、退出删除失败不复活账号、恢复重试401清除失效凭据、重试无凭据清旧错误。

公开方法签名不变，A/B/C/D既有调用兼容；不改HttpClient、DTO、后端、Asset配置、全局导航或共享环境配置。未skip、删除失败用例或放宽安全断言。

## 实际命令和结果

SDK：C:/Program Files/Huawei/DevEco Studio/sdk；Node：DevEco Studio/tools/node/node.exe。设置DEVECO_SDK_HOME，仓库根目录执行：

    node --test harmony/tests/auth.test.cjs

红灯：同步旧夹具并新增行为后14项11pass/3fail，exit1（red-initial.txt）；审查边界分别16项14pass/2fail、18项16pass/2fail，exit1（red-review.txt、red-retry.txt），均0cancel/skip。每组均先红再修。

最终全套，PowerShell实际展开28个文件：

    $cTests = @(Get-ChildItem -LiteralPath harmony/tests -Filter '*.test.cjs' | ForEach-Object { $_.FullName })
    & 'C:/Program Files/Huawei/DevEco Studio/tools/node/node.exe' --test @cTests

268/268，0fail/skip/TODO，exit0，见full-final.txt。原5项已全部修复或同步完整端口。

harmony目录设置NODE_HOME=DevEco tools/node、DEVECO_SDK_HOME=DevEco sdk、PORTRA_ENVIRONMENT=dev、PORTRA_BASE_URL=http://127.0.0.1:18090后：

    & 'C:/Program Files/Huawei/DevEco Studio/tools/hvigor/bin/hvigorw.bat' assembleHap --no-daemon -p product=dev

exit0，16.620秒，见build-final.txt。保留既有MomentPublishPanel异常处理/packing弃用及未配置签名警告，不宣称零警告。最终 unsigned/dev HAP SHA256：C8C416160B6939FD7B94CC632975C95DEC55A875250B74A294046F4E85B4F714。

独立只读复审最终无新增P1/P2；发现的重复轮转、退出复活及重试401状态问题已补回归并修复。归档auth-fix.patch为零上下文格式；最终源文件反向 git apply --reverse --unidiff-zero --check 退出0，旧基线应用使用git apply --unidiff-zero。

## 真实模拟器验收

最终包安装在Mate 90 Pro，HarmonyOS7/API26，1280x2832。device/final-check.txt的7项全部PASS：正常随机短信登录/普通角色切换、强停冷启动恢复、断网冷启动无可用认证、恢复映射后冷启动恢复同一身份、Home后前台恢复、正常退出、退出后冷启动仍游客。对应真实UI树及最终截图随附，重现命令为device/final-device-check.ps1。没有把Node调用作为设备证据；同进程显式重试、存储故障注入及并发故障仍属于Node行为验证范围。

地址http://127.0.0.1:18090来自HAP构建变量及本轮后端进程参数，真实可连通，是用户授权的本地隔离H2环境；不代表团队已确认staging。复用既有smoke产物和普通双角色夹具，H2名称portra_c_engagement_recovery_20261029但本轮是新内存进程，actorId=1，无管理员创建、验证码绕过或正式内容操作。

本机JVM回环UnixDomainSockets启动失败；仅为该测试进程指定仓库内短java.io.tmpdir/jdk.net.unixdomain.tmpdir后启动成功。没有修改系统/共享配置，hdc单条测试映射已恢复。这里只完成本地模拟器验收，不代表实体设备、签名包或团队跨端验收；动态图库选图/真实发布及之前其它未验事项保留原状态。