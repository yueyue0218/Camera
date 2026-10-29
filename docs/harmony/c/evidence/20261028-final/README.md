# 2026-10-28：C剩余共享接入与真实本地验收

仅本地隔离结果。用户明确确认B和公共维护者整包授权，另行允许在全新H2预置普通CUSTOMER/PROVIDER双角色，正常随机短信登录；未创建管理员、修改既有账号或角色校验。保留既有Web后台和原隔离库的合法管理员会话，不开发鸿蒙管理端。PR25继续Draft。

## 环境与产物区别

| 环境 | 来源、连通性与范围 |
| --- | --- |
| 后端127.0.0.1:18088 / Web127.0.0.1:15173 | 既有本机进程和配置，H2 portra_c_admin_20261027，原生/现有Web实际可达；普通作者2、举报者3；本轮moment2/report2，与原moment1/report1区分 |
| 后端127.0.0.1:18090 | 本轮新fixture/smoke/H2 portra_c_final_20261028，仅回环。普通actor1双角色、普通author2及moment1=A/moment2=B；不创建ADMIN。[夹具安全元数据](metadata.json) |
| Portra_C_API26 / hdc127.0.0.1:5555 | 官方HarmonyOS7.0.0.107/API26；反向转发18088→18088、18090→18090，包地址与目标实际对应；不是实体设备 |
| https://47.76.106.57 | 来源GitHub staging变量/仓库，TLS根页可达；原生短信能力/合法管理员/实际后端SHA仍未团队确认，本目录不作为staging通过依据 |

三种实际包：

- 原库闭环无诊断包：SHA256 C11B2231F7C44F1EB5F9B38A16728FA83E893BEF0CDD77294850069272AB1763，base18088，包含共享修复及作者/正常HALL接入，尚不含后续跨版本unknown兜底。
- 双角色原生事件观测包：SHA256 005FC452EC05A7E6B218E386D05A98A65AB7E75EF027C3321EA390F95618419A，base18090。仅C临时增加route/visible/stack/version/requestKey日志，不记录token/OTP/用户身份。覆盖root/HALL各3条真实路径；非手调生命周期。最后新增跨版本unknown兜底与此处生命周期源无关。
- **最终正式源码包**：SHA256 F1F1447BAF3CA072EC675E0E9200CC95832DB753958503A3670499D91AA9E5FF，base18090。临时日志已精确移除，新增跨版本unknown兜底，完整162项回归后构建安装；正常短信登录、HALL成功切角色再核实、未知结果/切对象、点赞及完整详情由此包实际验证。所有包均unsigned，模拟器安装成功不能称签名/真机验收。

## 同一reportId原生与Web闭环（原库）

新moment2标题C-FINAL-SHARED-20261028-TEST-ONLY；仅处理此测试对象。普通原生用户3真实POST产生report2，原因C-FINAL-SHARED-REPORT-20261028。

| 操作 | 证据 |
| --- | --- |
| 作者入口进入B真实公开主页 | [主页](final-shared-20261028-author.png) / [UI](final-shared-20261028-author.md)，真实昵称/角色/近期动态 |
| 鸿蒙真实提交一次 | [已提交](final-shared-20261028-native-submitted.png) / [UI](final-shared-20261028-native-submitted.md) |
| Web查同report2、MOMENT2、原因、PENDING | [同一记录](final-shared-20261028-web-report-2.png) |
| Web按正常流程下架 | [HIDDEN](final-shared-20261028-web-hidden.png) |
| 鸿蒙有效会话刷新 | [缺失moment2，原moment1仍在](final-shared-20261028-native-hidden.png) / [UI](final-shared-20261028-native-hidden.md) |
| Web独立合法restore | [VISIBLE](final-shared-20261028-web-restored.png)，没有重复resolve |
| 鸿蒙再刷新 | [moment2重新可见](final-shared-20261028-native-restored.png) / [UI](final-shared-20261028-native-restored.md) |
| 普通只读观察器正常登录GET | [原report2仍RESOLVED](old-db-report-after-restore.json)，原report1不再操作 |

## root和HALL分别覆盖真实路径（新双角色库）

root来自持久登录后正常冷启动，底部动态，Nav栈为空；HALL来自正常动态去登录成功目标Hall(tab1)，不是隐藏调试入口。Profile为真实导航遮盖，角色切换调用原接口成功，系统Home实际观察到launcher后才aa start恢复。

| 实际路径 | 截图/UI和原生日志 |
| --- | --- |
| HALL→我的→CUSTOMER切PROVIDER→返回 | [切前](final-hall-20261028-profile-before-role.png)、[切后](final-hall-20261028-role-provider.png)、[返回无旧草稿](final-hall-20261028-role-return.png)；[日志](hall-role-return-nav.txt)Hall stack1→隐藏stack2→stack1，version3→4 |
| HALL→系统Home→前台 | [恢复清草稿且真实Feed](final-hall-20261028-foreground.png)；[日志](hall-foreground-nav.txt)，同PID20667 |
| HALL→我的→退出→返回 | [游客登录提示](final-hall-20261028-logout-confirmed.png)；[日志](hall-logout-nav.txt)，version4→5 |
| HALL再次正常短信登录 | [栈日志](hall-relogin-single-destination-nav.txt)仍stack1，不叠加第二个Hall；另有3项实际completeLogin回归 |
| root→我的→PROVIDER切CUSTOMER→返回 | [切后](final-root-20261028-role-customer.png)、[返回无旧草稿](final-root-20261028-role-return.png)；[日志](root-role-return-nav.txt)ROOT stack0→隐藏stack1→stack0，version1→2 |
| root→系统Home→前台 | [恢复清草稿且真实Feed](final-root-20261028-foreground.png)；[日志](root-foreground-nav.txt)，同PID25683 |
| root→我的→退出→返回 | [游客提示](final-root-20261028-logout-confirmed.png)；[日志](root-logout-nav.txt)，version2→3 |

以上每张原生截图均有同名.md真实UI树。原草稿分别C-FINAL-HALL/ROOT-ROLE/BG/LOGOUT-DRAFT，均未提交。Node回归验证去重、旧结果失效和双实例精确取消，不能代替这些导航证据。

## 真实后端已写入但客户端超时（最终无日志包，新库）

仅在专用本机后端进程注册响应计时夹具：正常鉴权/校验/真实JPA提交全部执行，第一次成功POST /reports后将真实响应延迟18秒；不是客户端假响应、认证旁路或假数据。日志确认C_FINAL_REPORT_WRITTEN_RESPONSE_DELAY reportId=1，客户端既有15秒readTimeout触发。

| 操作 | 实际结果 |
| --- | --- |
| 对moment2=B提交一次C-FINAL-UNKNOWN-20261028-B | [超时结果待核实](final-report-20261028-unknown.png)，不存在提交按钮，无自动重发 |
| 关闭并重开同对象 | [仅核实](final-report-20261028-reopened.png)，不恢复原因输入和提交状态 |
| 正常listMyReports核实 | [真实举报#1/PENDING/时间](final-report-20261028-verified.png)，仍提醒历史相似记录不自动等于本次成功 |
| 我的→成功切CUSTOMER到PROVIDER→返回重开 | [跨逻辑版本仍禁重发](final-report-20261028-role-reopened.png)；[当前身份正常查询#1](final-report-20261028-role-verified.png) |
| 切到其他moment1=A | [全空新表单](final-report-20261028-other-target-blank.png)，未提交第二条，不继承B状态 |
| 独立普通只读观察器正常SMS登录GET /reports/my | [核对结果](final-report-observation.json)：totalReports=1、matchingReports=1、report1/MOMENT2/PENDING，无重复写入 |

防重记录仅进程内存，不声称杀进程/重装或服务器间幂等。核实显示真实记录供人工判断，不把“查不到”当未写入，不盲目再发。

最终包另外实际[点赞后1](final-package-20261028-liked-detail.png)→取消0并浏览[完整5/5](final-package-20261028-unliked-five.png)，Feed仍3图预览。前一轮更完整的服务器观察/下架详情失败/恢复回归见[点赞详情证据](../20261028-like-detail/README.md)。

## 命令和结果

在harmony目录：DEVECO_SDK_HOME设置本机SDK，node --test全部tests/*.test.cjs（PowerShell显式展开）exit0、162/162、0TODO；PORTRA_REQUIRE_SHARED_REPORTS=1 node --test tests/moment-report-contract.test.cjs exit0、24/24。独立审查对应五文件46/46，无P1/P2。PORTRA_BASE_URL=http://127.0.0.1:18090 hvigorw.bat assembleHap --no-daemon -p product=dev：exit0、16.896秒、33tasks（17执行16up-to-date）。hdc install -r、aa start均0。完整命令、失败及限制见[交付](../../c-module-delivery.md)。

未完成：团队外部原生短信/后端部署SHA及合法管理员确认、在该环境重复闭环、实体设备/签名/升级和运营商网络。没有实时推送承诺；可见性以刷新/重进请求为准。本目录不含密码、OTP、令牌、原始系统日志或安装包。
