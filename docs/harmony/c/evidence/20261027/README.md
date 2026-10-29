# C本地原生验收证据

仅包含合成测试内容。环境为官方API26模拟器、loopback后端18088、Web15173，新H2内存库`portra_c_admin_20261027`；不是staging或真机发布签名验收。没有密码、验证码、token、原始日志或个人用户内容。

| 文件 | 证明范围 |
| --- | --- |
| [native-submitted.png](native-submitted.png) | 原生ReportPanel对唯一测试对象提交成功，仅一次 |
| [native-report-record.json](native-report-record.json) | 同一普通账号正常登录后只读GET，唯一reportId1/MOMENT1/PENDING |
| [web-report-1.png](web-report-1.png) | Web同一举报ID、对象和唯一原因标记 |
| [web-hidden.png](web-hidden.png) | Web下架后独立恢复按钮可用、下架按钮禁用；完整状态及对象见delivery中的实际AX记录说明 |
| [native-hidden.png](native-hidden.png) | 正常原生重新登录后的有效会话空Feed；过期登录提示未算通过 |
| [web-restored.png](web-restored.png) | 同一测试对象No.000001恢复VISIBLE，正常内容恢复流程 |
| [native-restored.png](native-restored.png) | 鸿蒙点击刷新后同一测试标题/ID重新出现，预览3图 |
| [native-report-after-restore.json](native-report-after-restore.json) | 独立恢复后原举报仍RESOLVED，未重复resolve |
| [root-foreground.png](root-foreground.png) | 前一轮2026-10-26真实Home/同PID恢复后新标题可见，热门scope保留，旧举报清理 |
| [root-logout.png](root-logout.png) | 前一轮同日个人页正常退出返回root后仅登录提示 |
| [final-package-feed.png](final-package-feed.png) | 最终互斥修复包正常重新登录后的真实Feed，不代表覆盖安装持久会话恢复通过 |
| [final-draft-protected.png](final-draft-protected.png)、[设备属性](final-draft-guard-state.json) | 同条举报草稿未提交，收藏真实enabled=false，点击后草稿与计数保持 |
| [final-favorite-after-close.png](final-favorite-after-close.png) | 关闭草稿后正常收藏成功，功能恢复，无第二次举报提交 |

前一轮root截图来自独立设备库`portra_c_device_20261025`，不与本轮同号举报串联。源截图和JSON仅复制为交付证据，没有编辑画面或虚构响应。[完整过程、命令、失败和剩余项](../../c-module-delivery.md)。
