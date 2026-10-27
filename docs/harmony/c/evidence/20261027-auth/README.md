# C-AUTH-01：安全存储作用域对照

本目录保留修复前诊断，并补充获授权后的真实设备验收。**2026-10-27 用户确认已获认证维护者授权，两行补丁已应用。** 临时C日志及属性诊断均已移除，最终HAP不含诊断代码；没有读取或导出设备资产SECRET，HTTP对照凭据只留在进程内存。

- 正常原生登录后39秒，不登出、不覆盖安装，仅force-stop/start：PID8283→8942，C仍为guest。[实际截图](immediate-cold-start-guest.png)。因此“覆盖安装”不是复现的必要条件。
- 正常登录后C会话为authenticated；仅属性查询省略REQUIRE_ATTR_ENCRYPTED，22:19及22:21均返回24000002。
- 不重新登录，仅将临时属性查询设置为true，22:25得到已有记录数量1，同时公共恢复仍为guest。这支持记录存在但公共查询作用域不匹配，不支持“凭据一定丢失”的描述。
- 同一本地普通账号的正常HTTP登录→真实native refresh→正常退出对照成功，凭据未输出。
- [结构化结果与包摘要](asset-scope-findings.json)。诊断包仅改C，只记录状态码、记录数，使用ATTRIBUTES而非ALL；不提交诊断HAP、凭据或原始系统日志。

依据：[官方query规则](https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/security/AssetStoreKit/asset-js-query.md)、[官方remove规则](https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/security/AssetStoreKit/asset-js-remove.md)。两者的REQUIRE_ATTR_ENCRYPTED默认false；save已有true。该标记是业务自定义附属信息的加密作用域，false不等于SECRET明文存储。

修复前真实公共存储契约严格模式2失败；内存候选2通过。授权后[两行补丁](../../proposals/asset-credential-store-encrypted-scope.patch)只在load/clear中加true，测试已去除TODO与候选替换，直接执行真实源码。认证12/12、全套107项100通过/7既有举报TODO，退出均0。

## 授权后原生验收

环境仍为独立H2 `portra_c_admin_20261027`、loopback18088、官方API26模拟器；普通用户3、moment1及收藏1均为本轮测试对象。通过设备真实点击、force-stop/start和安装完成，不是Node手动调用生命周期。

| 时间（北京时间） | 实际结果 |
| --- | --- |
| 22:44 | 带两行真实修复的观察包读回此前已存在的加密记录，无新短信；真实Feed及已收藏1恢复。attrsOnlyCount=1，状态authenticated/version1。[截图与UI](auth-fixed-existing-record-restored.png) |
| 22:44 | force-stop/start后PID30681→30710，Feed恢复；同一观察HAP覆盖安装后PID31521，仍恢复 |
| 22:45 | 真实我的→退出→返回，仅登录提示；临时属性查询24000002，证实加密记录已删除。[截图](auth-fixed-logout-guest.png)。再冷启动PID31585仍guest/NOT_FOUND |
| 22:47 | 临时诊断移除，最终包正常随机短信登录成功；force-stop/start PID461→1003，无短信重新登录，Feed与已收藏1恢复。[截图](auth-final-cold-restored.png)、[实际UI树](auth-final-cold-restored.md) |
| 22:48 | 同一最终HAP `install -r`后启动，正常动态入口恢复同一Feed/收藏。[截图](auth-final-overwrite-restored.png)、[UI树](auth-final-overwrite-restored.md)。首帧入口断言曾退出1，重新读取确认大厅后正常点击成功；没有盲点或重发短信 |
| 22:49 | 最终包正常退出后冷启动，仍为游客且无测试动态、旧举报或表单。[截图](auth-final-logout-cold-guest.png)、[UI树](auth-final-logout-cold-guest.md) |

观察包及最终包共10次实际UI树断言通过，命令退出0；观察包只记录状态/错误码/属性数量，不提交原始hilog。修复前`asset-scope-findings.json`的publicAuthModified=false描述当时诊断阶段，不代表最终状态。

最终 `hvigorw.bat assembleHap --no-daemon -p product=dev`：退出0，15.412秒，33 tasks（17执行、16 up-to-date）；HAP SHA256 `318E4AF5BC3F8D1C8877398F928F9BFC7B9EA134303687DE5D58A9C7BC94675B`。同一产物安装/启动退出均0，包不提交。模拟器接受unsigned不能替代实体设备、发布签名或同签名版本升级验收；staging、锁屏访问控制及长时间令牌过期恢复仍未在本轮验证。跨环境隔离由真实源码契约测试覆盖，不能声称已在双环境设备实测。
