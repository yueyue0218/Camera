# 点赞与详情：2026-10-28真实本地验收

用户明确确认已获公共网络维护者授权，应用ApiService点赞/详情五个方法及校验辅助方法，共47行新增。仅复用原认证HttpClient，不修改DTO、认证、B表单、公共导航、Web或后端源码。起点5625ce0；远端integration仍b258ec8。

## 环境和对象

原隔离H2 `portra_c_admin_20261027`，后端 `http://127.0.0.1:18088`，Web `http://127.0.0.1:15173`。两者来源为既有本机测试进程配置，本轮实测可连通，属于用户授权本地测试，**不是团队确认的staging验收环境**。设备18088→本机18088，官方Portra_C_API26、HarmonyOS7.0.0.107/API26。只处理普通作者2的moment1 `C-NATIVE-20261027-TEST-ONLY`，原生普通用户3；管理员为原本地空库测试账号，正常Web密码登录，没有提权或重置。

正常随机短信登录，未固定验证码、注入会话或导出token。只读HTTP观察器以普通作者2正常登录，GET核对服务器计数/图片后正常退出；不是用HTTP写操作冒充鸿蒙点赞。凭据、验证码、夹具及原始日志均不提交。

## 真实操作与结果

| 操作 | 实际证据 |
| --- | --- |
| 原生Feed初始 | [截图](feed-before.png)、[UI树](feed-before.md)：点赞0、收藏1，预览3张 |
| 原生Feed点赞 | [已赞1](liked.png)，另一普通会话GET确认likeCount=1；真实PUT由公共ApiService发出 |
| 原生打开详情 | [1/5](detail-one.png)，真实GET响应提供完整5图；不是Feed预览扩展 |
| 原生浏览完整图 | 实际依次2/5、3/5、4/5至[5/5](detail-five.png)，图片等比完整显示 |
| 原生详情取消点赞 | [仍在5/5且点赞0](detail-unliked.png)，Feed同步0；另一普通会话GET确认服务器0，真实DELETE而非POST toggle |
| 关闭、重进、系统返回 | 第五张关闭后[重进从1/5](reopened.png)，重新GET；真实系统Back只关闭sheet，原Feed仍在 |
| Web下架→原生重进 | Web动态管理独立[下架HIDDEN](web-hidden.png)，原生从未刷新的卡片重进显示[内容不存在](hidden-detail.png)，不保留旧相册并移除旧卡片 |
| Web恢复→原生重读 | Web独立[恢复VISIBLE](web-restored.png)，原生错误页“重新读取详情”恢复[同一对象1/5](restored-detail.png)，关闭并刷新后[Feed重新可见](restored-feed.png) |
| 真实后台恢复 | 先观察到系统桌面，再aa start，同PID19730恢复；[详情消失、Feed重读](observed-foreground.png)。先前Home后立即start、未先观察桌面的采集断言曾退出1，未计通过 |
| 举报草稿保护 | 仅输入`C-LIKE-DETAIL-DRAFT-ONLY`，真实点击同条点赞和详情均不动作，[草稿保留且点赞仍0](draft-protected.png)。随后正常关闭，未提交新举报 |

[服务器只读记录](server-counts.json)保留before0→liked1→unliked0及恢复后detail0、完整5图/Feed3图；viewerId2不是原生操作者3，记录不伪称当前用户liked状态。原举报没有重新resolve，未重提举报。此次Web登录首次追加输入触发表单9位校验，正常替换输入后登录通过；未修改校验或登录源码。

## 测试与构建

所有命令在C独立工作区执行，SDK为本机DevEco默认SDK，Node为DevEco自带版本。

| 命令 | 退出码 / 结果 |
| --- | --- |
| 公共候选契约（应用前） | 原实现exit1；内存候选8/8通过、exit0；补丁适用性检查0。授权后已移除候选替换，测试迁入正式suite |
| `node --test harmony/tests/moment-api-contract.test.cjs` | 8/8通过，已包括在最终全套；真实ApiService/HttpClient，只替换NetworkKit系统边界 |
| `node --test harmony/tests/moment-interactions.test.cjs harmony/tests/moment-feed-behavior.test.cjs` | 最后45/45通过、exit0，独立审查也执行通过 |
| `node --test harmony/tests/*.test.cjs` | **exit0，134项：127通过、7执行TODO、0跳过** |
| `PORTRA_REQUIRE_SHARED_REPORTS=1; node --test harmony/tests/moment-report-contract.test.cjs` | **exit1，9项：2通过、7失败**，共享举报缺口仍未解除 |
| `hvigorw.bat assembleHap --no-daemon -p product=dev` | 前3次exit1：ArkTS名义类型/方法接口对象字面量限制，分别74.766s、16.181s、16.486s；C内显式implements委托后，最终**exit0、24.445s、33tasks（17执行/16 up-to-date）** |
| `hdc -t 127.0.0.1:5555 install -r [HAP]`、`shell aa start -b com.portra.app -a EntryAbility` | 均exit0，正常原生短信登录通过 |
| 官方Emulator真实click/uiLayout/screenshot、HDC系统Back/Home、服务器只读观察器 | 最终操作及断言通过、exit0；不是Node手调设备生命周期 |

最终unsigned HAP：`harmony/entry/build/dev/outputs/dev/entry-dev-unsigned.hap`，SHA256 **6BBF07CB67229B1484E7DDD2ECBC0B54E6DEC7A32EC59ED7F74E05A7FCE5899E**。进程PORTRA_BASE_URL仅loopback18088，无诊断代码，包不提交。模拟器接受unsigned不代表发布签名/实体设备就绪。

## 行为边界与审查

新增测试覆盖旧success/catch/finally、换对象/关闭/账号变化、请求按实例取消、重复点击、超时结果不明禁重发、明确空相册/重复图顺序，以及Feed始终仅3图预览。先读后写的跨实例时序使用C缓存写revision；旧成功与旧错误均失效，等待已知写完成后最多补一次GET，第二次再冲突则丢弃，不轮询、不重放写。

独立审查发现的404标记残留、顶部核实绕过举报保护及旧GET清不明状态等P2均先补失败回归再修复，最终复核无Critical/Important。B原`MomentCard({item})`仍保留只读默认及旧属性；新增回调均可选，未修改B。

未验证：staging、真机/发布签名、实体同签名升级、运营商短信、长Feed/大图性能、成功双身份切换及HALL实际路径。超时/取消与多实例争用主要为实际源码自动回归，未伪称都在设备制造过。共享举报7项、作者主页入口等仍在交接，完整C未验收完成，PR25继续Draft。
