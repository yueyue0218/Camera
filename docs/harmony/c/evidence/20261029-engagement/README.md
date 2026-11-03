# 200字手机弹窗与精确通知：真实模拟器证据

2026-10-29（北京时间）。官方 Portra_C_API26，HarmonyOS7.0.0.107/API26，1280×2832、560dpi。用户本轮明确只要求模拟器。所有数据为专用本地测试对象；没有正式用户、管理员新增或真实资金。

## 环境、产物与证据来源

- 地址配置来源：构建进程 PORTRA_BASE_URL=http://127.0.0.1:18090；对应本机 smoke/H2，hdc Reverse tcp:18090→tcp:18090。正常原生/HTTP业务均实际连通。这是用户授权的隔离本地环境，未被称为团队已确认的staging。
- 初轮数据库 portra_c_final_20261028：实际原生提交 review4/order2、其追评、complaint1/review3/order2、dispute2/order3；独立新order6/dispute3验证系统Back后保留的D订单列表由旧状态变“申诉中”。对应截图及[返回RED](order-return-before.json)/[返回GREEN](order-return-after.json)保留。内存进程在会话中断期间停止，未对消失的库伪造补读结果。
- 恢复运行是**全新** portra_c_engagement_recovery_20261029，端口相同、实例不同：[安全夹具元数据](recovery-metadata.json)、[普通流程对象](recovery-objects.json)。只预置用户1普通双角色，随机短信正常登录，正常报价/确认/现有MOCK_PAY/交付/客户确认生成订单；不改既有角色、认证或后端源码。时间分离以遵守真实拍摄占用校验。
- 最终正式HAP SHA256 **96853387CA72C675BB6A2B6158022A08191ACA807294BF4973C466C0AC9AF5F2**。report、report-unknown、report-verified、review、followup、review-complaint、order-dispute、review-keyboard-200、foreground-cleared、notice-order、notice-dispute截图来自此最终包，已实际安装。包不提交。
- 初轮review-saved、followup-keyboard-200、complaint-saved及order-dispute-saved来自前期真实提交包；C表单控制器/布局随后仅修复成功提示保留与D列表返回刷新。dispute-reply、notice-complaint/followup、order-return-refreshed来自A2C3EDB4DE09AF38C3E604D3912F9B4687CC12F5F3159688617A617C83734AF3包。最终包另修复共享举报cancelForm清理，未拿前期包冒充该修复的验收。

## 实际原生行为

| 验证 | 结果与截图（同名.md为实际UI树） |
| --- | --- |
| 评价、评分、提交 | [最终200字评价表单](review.png)；[原生成功保存](review-saved.png)，服务器重读后review4/5星 |
| 追加追评 | [最终表单](followup.png)；初轮真实POST后记录含追评；[系统键盘+200字](followup-keyboard-200.png)，输入区可滚、剩余0、底部操作在键盘上方 |
| 评价申诉 | [最终原因单选+200字说明](review-complaint.png)；[真实complaint1保存](complaint-saved.png)，只采用用户态接口 |
| 订单申诉 | [表单](order-dispute.png)、[真实dispute2保存](order-dispute-saved.png)；发起人没有回复入口 |
| 对方申诉回复 | [200字表单](dispute-reply.png)、[原生保存REPLIED](dispute-reply-saved.png)；当前用户1回复dispute1/order4，之后回复入口消失 |
| 举报样式/关闭 | [最终五原因单选及200字补充](report.png)；输入草稿→取消→重开，实际内容空、计数200；不再残留旧草稿 |
| 举报200/201边界 | [实际200字及剩余0](report-200.png)。官方-fill输入201报告失败，但随后的实际UI断言确认只保留200；不把工具失败写成命令成功。关闭后再重开填入独立短测试说明，未提交边界占位文本 |
| 举报超时与核实 | 最终包真实提交一次REVIEW3；专用夹具先完成DB事务再延迟18秒，客户端15秒超时。[编辑弹窗关闭、结果待核实](report-unknown.png)，[原生核实唯一#1/PENDING](report-verified.png)。无再次POST |
| 最终包键盘/前台恢复 | [实际200字+系统键盘](review-keyboard-200.png)，输入区滚动后计数0和提交按钮均在键盘上方；实际Home观察到launcher后aa start，[旧草稿已清](foreground-cleared.png)，重开为空/剩余200。没有提交边界占位文本 |
| 订单通知 | [通知38→真实order6](notice-order.png)，订单号O202610291432176、当前待拍摄；不是订单列表 |
| 订单纠纷通知 | [通知52→dispute2/order7](notice-dispute.png)，当前普通customer3合法读取OPEN记录；没有把dispute2当order2；[旧账号目标403](old-target-forbidden.png) |
| 独立只读核对 | [普通会话GET快照](recovery-observer-final.json)：全库本人举报仅1条，report1/REVIEW3；dispute1/order4=REPLIED，回复只有1条、replier1。观察器不写举报、回复或通知已读 |
| 评价申诉通知 | [真实通知48→complaint2/review4/order2](notice-complaint.png)；申诉记录置顶，不把review4当订单4 |
| 追评通知 | [真实通知45→review3/order2](notice-followup.png)，对应评价置顶、展示真实追评；[服务端typed元数据](recovery-peer-notifications.json) |
| 返回列表刷新 | [真实新order6提交后system Back](order-return-refreshed.png)，列表“申诉中”；没有重启、清栈或Node手调生命周期 |

## 自动检查与失败记录

在C独立工作区harmony目录，DEVECO_SDK_HOME使用本机DevEco SDK，Node使用DevEco内置版本：

| 实际命令 | 退出码 / 结果 |
| --- | --- |
| PowerShell展开Get-ChildItem tests/*.test.cjs后 node --test 全部文件 | **0，216/216，0fail/skip/TODO，4.827秒（最终重跑）** |
| node --test --test-name-pattern='cancel clears editable' tests/moment-report-contract.test.cjs（修复前） | **1**；旧原因未清，真实源失败回归 |
| 独立复核 node --test tests/moment-report-contract.test.cjs | **0，26/26**；取消草稿不解除unknown防重 |
| PORTRA_BASE_URL=http://127.0.0.1:18090；hvigorw.bat assembleHap --no-daemon -p product=dev | **0，1分9.971秒，33tasks，17executed/16up-to-date** |
| hdc install -r entry-dev-unsigned.hap；shell aa start -b com.portra.app -a EntryAbility | **0/0**；实际覆盖安装、普通会话恢复、原生提交及核实 |
| node observe-final.cjs（仅正常认证后GET业务） | **0**；唯一report1及单条真实申诉回复 |
| git apply --reverse --check --unidiff-zero 最终补丁 | **0**；应用状态可复核，无需重复应用 |

真实设备发现并修复两项Node无法替代的问题：@Builder把初始禁用状态冻结，填字后按钮仍不可点；改为直接读取form的按钮后[实际属性false](submit-enabled-before.json)→[true](submit-enabled-after.json)，随后原生真实提交。取消举报残留正文的模拟器RED及NodeRED后，最终包重开空表单GREEN。订单返回旧状态也有上述实际RED/GREEN。旧success/catch/finally、换目标/身份、跨实例取消、未知写入核实由真实源回归覆盖；未把Node手动调用当作设备事件。

恢复脚本出现过GBK编译、旧/新classpath混用及重复Mapper失败，改为UTF-8和C分支当前classes+已有jar依赖后启动成功；没有改共享配置。普通报价准备曾40901（真实时段占用），修正独立测试时段；peer申诉准备首次传错evidenceFileIds数组返回50001，核对实际String契约后使用空字符串，原生payload始终正确。短信冷却40001、重复填充号码、超屏按钮与内部ID不存在的采集断言均中止后按实际UI修正，未绕过验证、未重复举报。

## 边界

200/201中文正文由真实源测试覆盖；官方-fill只支持ASCII，设备长文使用合成ASCII，不冒称中文输入法专项验收。已验证这一官方手机尺寸、键盘和滚动；其他屏幕尺寸/大字体未实测。进程内防重不等于跨进程后端幂等。

现后端ReportService.resolve仍未生成举报处理结果通知；没有虚构此通知或自动跳转。待后端维护者提供事件后，才能验证同reportId结果通知。关注通知缺可靠角色，保留正文。不是所有Web业务或系统推送迁移。先前原生→Web下架/合法恢复闭环证据保留在20261028-final，本轮没有再次resolve既有举报。staging原生认证、部署SHA、合法后台及发布签名升级仍未验证；unsigned模拟器包不称发布联调包。PR25保持Draft、base integration/harmony-v1，不合并。

纠纷目标首次遇原账号会话过期，正常短信重登触发既有每小时频率限制，未放宽。正常随机短信创建新普通CUSTOMER3；旧dispute1/order4在新账号登录返回后403，未泄露旧记录。随后正常报价/确认/MOCK_PAY/申诉生成其本人新通知52→dispute2/order7，见recovery-third-account-target.json；不改旧账号、角色或权限。最终补充核查：216/216再跑exit0、4.827秒，严格共享举报26/26 exit0；git暂存边界与20文件SHA、9个授权边界、HAP SHA、Markdown链接和证据无凭据扫描均通过。系统桌面采集一度只因预期应用名称集合过窄而断言退出1，重新读取实际Swiper/联系人launcher后恢复并验证清理成功，未把该错误算产品失败或已通过。
