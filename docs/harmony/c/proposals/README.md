# 公共维护者候选补丁

## C-AUTH-01 / P1：读取、删除与保存作用域一致

目标：`harmony/entry/src/main/ets/storage/AssetCredentialStore.ets`，公共认证/安全存储维护者所有。**2026-10-27 用户明确确认已获维护者授权，已将两行补丁应用到真实生产文件。授权仅限这两处。**

候选：[asset-credential-store-encrypted-scope.patch](asset-credential-store-encrypted-scope.patch)。只在`load()`和`clear()`的ALIAS查询后增加：

```ts
query.set(asset.Tag.REQUIRE_ATTR_ENCRYPTED, true);
```

`save()`已固定true；官方query/remove默认false，因此当前读取返回NOT_FOUND，清理也可能留下真实加密属性记录。标记区分附属信息加密作用域，不表示false的SECRET是明文。工程最低兼容API26，该标记自API14支持。既有方法签名、环境namespace、别名、加密强度、refresh/logout与A/B/C调用均保持不变；没有证据要求扩大双作用域读写或删除。

实际公共代码和[官方规则](https://raw.githubusercontent.com/openharmony/docs/master/zh-cn/application-dev/security/AssetStoreKit/asset-js-query.md)一致性见[设备只读证据](../evidence/20261027-auth/README.md)。原`auth.test.cjs`的native替身仅以alias索引，未模拟该分区，故旧测试未暴露此缺口；本次新增C交接测试执行真实共享存储方法，仅补native边界语义，不修改原公共测试文件。

在C独立工作区，先设置本机SDK和Node：

```powershell
$env:DEVECO_SDK_HOME = 'C:\Program Files\Huawei\DevEco Studio\sdk'
git apply --reverse --check docs/harmony/c/proposals/asset-credential-store-encrypted-scope.patch
node --test harmony/tests/moment-auth-storage-contract.test.cjs
```

补丁应用前 `git apply --check` 退出0，原实现严格模式退出1（2失败），内存候选2通过。应用后正向检查不再适用；检查已应用状态可用：

```powershell
git apply --reverse --check docs/harmony/c/proposals/asset-credential-store-encrypted-scope.patch
node --test harmony/tests/auth.test.cjs harmony/tests/moment-auth-storage-contract.test.cjs
node --test harmony/tests/*.test.cjs
```

两项契约现为无条件测试，直接执行真实生产源码，不再使用内存替换或TODO开关。认证相关12/12通过；全套107项100通过、7项既有共享举报TODO，均退出0。测试覆盖保存后读取、清除真实加密分区、重复清除和其他环境资产隔离。

官方API26模拟器已通过已有凭据恢复、force-stop/start、同一未签名产物覆盖安装、正常退出及退出后冷启动游客；退出后临时只查ATTRIBUTES确认加密记录NOT_FOUND。临时C诊断已移除，最终构建与真实恢复详见[设备证据](../evidence/20261027-auth/README.md)。实体设备、发布签名及同签名升级仍未验证；本地结果不能替代staging。
