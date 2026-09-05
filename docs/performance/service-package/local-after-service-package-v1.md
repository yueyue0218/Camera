# GET /service-packages A3 After 性能复测

## 1. 基准身份

- After matrix：`local-after-service-package-v1`
- 测试日期：2026-09-04
- 分支：`perf/service-package-batch`
- A1 commit：`7ce47d11735d2dcf7395f54621c7e935245dd448`
- A2 commit：`b2a5141e64b56bd103dd82d1c2ec9684f5dcc741`
- 请求：`GET /service-packages?page=1&size=10`
- 排序路径：默认 `latest`
- 结果：24/24 正式请求成功

本文件是 A3 After 的正式 tracked 报告。原始 CSV、响应、应用日志、SQL 日志和标准输出位于 `backend/target/performance`，属于 ignored local evidence，不随 Git 提交。

## 2. 环境

| 项目 | 值 |
| --- | --- |
| OS | Microsoft Windows 11 Home Chinese，64-bit，10.0.26200 |
| JDK | Oracle JDK 17.0.12 |
| Maven | Apache Maven 3.9.16 |
| 数据库 | MySQL 8.0.41，`127.0.0.1:3306` |
| Benchmark DB | `camera_perf_a1` |
| 字符集 | `utf8mb4` |
| 排序规则 | `utf8mb4_0900_ai_ci` |
| Dataset | `local-service-package-perf-dataset-v1` |
| Dataset seed SHA-256 | `58498B10904AF0E9454368179CC3869584E66BF50CF4105C24325DA17CC3A7DE` |
| Page | 1 |
| Page size | 10 |

### 冻结数据集核验

After 执行前后未重新 seed 或修改 benchmark dataset。只读核验结果与 A1 manifest 全部一致：

| 数据 | 数量 / 状态 |
| --- | ---: |
| Users | 28 |
| Active provider users | 27 |
| User role bindings | 29 |
| Provider profiles | 27 |
| Service packages | 54 |
| Public ONLINE/VISIBLE packages | 54 |
| Distinct package providers | 27 |
| Conversations | 27 |
| Quotes | 27 |
| Orders | 27 |
| Completed orders | 18 |
| Provider-fault refunded orders | 9 |
| Payment records | 27 |
| Reviews | 36 |
| Visible customer-to-provider reviews | 27 |
| Hidden provider-to-customer reviews | 9 |
| Resolved review complaints | 9 |
| Resolved provider-fault disputes | 9 |

## 3. 测量方法

After 完全复用 A1 测量条件：

- Cold：每次启动新的 JVM、Spring Context、SessionFactory 和 Hikari，应用 ready 后仅执行一个正式请求，然后停止 JVM 并等待端口释放；共 12 次。
- Warm：启动一个新的 JVM，先执行 5 次不计入矩阵的预热请求，再在同一 JVM 连续执行 12 次正式请求。
- 不清理 MySQL buffer pool。
- 每个请求使用唯一的 `X-Performance-Run-Id`。
- Hibernate SQL 取当前 SessionFactory statistics delta。
- MyBatis SQL 取同一 Run ID 下 `ProviderProfileMapper` 的 `Preparing:` 日志。
- Backend Time 在 A1 Probe 内测量。
- Total Time 由外部 HTTP 客户端测量。
- Metadata Time 覆盖当前页摄影师 metadata 批量装配阶段。
- P95 使用与 A1 相同的 `PERCENTILE.INC` 线性插值口径。

## 4. 完整 24-run After matrix

| Run ID | Phase | SQL | Hibernate | MyBatis | Backend ms | Total ms | Metadata ms | Candidates | Photographers | HTTP | Business | Records | Success |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| cold-01 | Cold | 8 | 7 | 1 | 980.147 | 1178.198 | 401.878 | 10 | 5 | 200 | 200 | 10 | Yes |
| cold-02 | Cold | 8 | 7 | 1 | 982.526 | 1269.500 | 378.965 | 10 | 5 | 200 | 200 | 10 | Yes |
| cold-03 | Cold | 8 | 7 | 1 | 851.260 | 1028.430 | 393.030 | 10 | 5 | 200 | 200 | 10 | Yes |
| cold-04 | Cold | 8 | 7 | 1 | 793.353 | 1062.190 | 387.717 | 10 | 5 | 200 | 200 | 10 | Yes |
| cold-05 | Cold | 8 | 7 | 1 | 1047.187 | 1340.473 | 366.022 | 10 | 5 | 200 | 200 | 10 | Yes |
| cold-06 | Cold | 8 | 7 | 1 | 902.279 | 1068.594 | 400.370 | 10 | 5 | 200 | 200 | 10 | Yes |
| cold-07 | Cold | 8 | 7 | 1 | 933.641 | 1046.748 | 373.790 | 10 | 5 | 200 | 200 | 10 | Yes |
| cold-08 | Cold | 8 | 7 | 1 | 923.604 | 1199.436 | 437.665 | 10 | 5 | 200 | 200 | 10 | Yes |
| cold-09 | Cold | 8 | 7 | 1 | 858.242 | 1011.600 | 390.268 | 10 | 5 | 200 | 200 | 10 | Yes |
| cold-10 | Cold | 8 | 7 | 1 | 859.020 | 1068.577 | 425.996 | 10 | 5 | 200 | 200 | 10 | Yes |
| cold-11 | Cold | 8 | 7 | 1 | 869.072 | 1005.139 | 399.049 | 10 | 5 | 200 | 200 | 10 | Yes |
| cold-12 | Cold | 8 | 7 | 1 | 1012.356 | 1299.229 | 382.359 | 10 | 5 | 200 | 200 | 10 | Yes |
| warm-01 | Warm | 8 | 7 | 1 | 47.722 | 51.310 | 25.764 | 10 | 5 | 200 | 200 | 10 | Yes |
| warm-02 | Warm | 8 | 7 | 1 | 64.202 | 67.887 | 20.287 | 10 | 5 | 200 | 200 | 10 | Yes |
| warm-03 | Warm | 8 | 7 | 1 | 76.040 | 79.706 | 27.930 | 10 | 5 | 200 | 200 | 10 | Yes |
| warm-04 | Warm | 8 | 7 | 1 | 43.118 | 46.599 | 23.131 | 10 | 5 | 200 | 200 | 10 | Yes |
| warm-05 | Warm | 8 | 7 | 1 | 64.670 | 67.958 | 22.727 | 10 | 5 | 200 | 200 | 10 | Yes |
| warm-06 | Warm | 8 | 7 | 1 | 65.349 | 68.446 | 23.203 | 10 | 5 | 200 | 200 | 10 | Yes |
| warm-07 | Warm | 8 | 7 | 1 | 68.556 | 71.679 | 25.905 | 10 | 5 | 200 | 200 | 10 | Yes |
| warm-08 | Warm | 8 | 7 | 1 | 67.404 | 70.645 | 24.108 | 10 | 5 | 200 | 200 | 10 | Yes |
| warm-09 | Warm | 8 | 7 | 1 | 60.518 | 63.975 | 22.029 | 10 | 5 | 200 | 200 | 10 | Yes |
| warm-10 | Warm | 8 | 7 | 1 | 61.733 | 65.118 | 25.828 | 10 | 5 | 200 | 200 | 10 | Yes |
| warm-11 | Warm | 8 | 7 | 1 | 68.135 | 71.347 | 27.177 | 10 | 5 | 200 | 200 | 10 | Yes |
| warm-12 | Warm | 8 | 7 | 1 | 33.439 | 36.844 | 19.569 | 10 | 5 | 200 | 200 | 10 | Yes |

所有正式响应均满足：HTTP 200、BusinessCode 200、Success true、Records 10、Total 54、CandidateCount 10、PhotographerCount 5、Hibernate 7、MyBatis 1。全部 stderr 文件为空，CSV Error 字段为空。

## 5. Cold / Warm 统计

单位：毫秒；SQL 行除外。

| Phase / metric | Min | Average | Median | P95 | Max |
| --- | ---: | ---: | ---: | ---: | ---: |
| Cold SQL | 8 | 8 | 8 | 8 | 8 |
| Cold Backend | 793.353 | **917.724** | 912.942 | 1028.030 | 1047.187 |
| Cold Total | 1005.139 | **1131.510** | 1068.586 | 1317.789 | 1340.473 |
| Cold Metadata | 366.022 | **394.759** | 391.649 | 431.247 | 437.665 |
| Warm SQL | 8 | 8 | 8 | 8 | 8 |
| Warm Backend | 33.439 | **60.074** | 64.436 | 71.924 | 76.040 |
| Warm Total | 36.844 | **63.460** | 67.922 | 75.291 | 79.706 |
| Warm Metadata | 19.569 | **23.972** | 23.656 | 27.516 | 27.930 |

## 6. SQL 排他分类

24 个正式 run 的 SQL 形状一致。每条语句只归入一个主用途：

| 分类 | 每请求数量 |
| --- | ---: |
| ServicePackage page | 1 |
| ServicePackage count | 1 |
| User batch | 1 |
| ProviderProfile batch | 1 |
| Review aggregation | 1 |
| Order aggregation | 1 |
| ReviewComplaint aggregation | 1 |
| Dispute aggregation | 1 |
| **合计** | **8** |

Hibernate 共 7 条；ProviderProfile 的 MyBatis batch query 共 1 条。CSV 的诊断列按 SQL 文本中的表名计数，因此含 JOIN 的 Order 聚合会同时命中 Review，Dispute 多行 native SQL 的首行不会直接出现表名；正式排他分类以完整 SQL 语句的主用途为准。

SQL 从 163 降至 8，达到 `SQL <= 约 15` 的验收目标，且不再随摄影师数量线性增长。

## 7. Before / After 对比

Reduction 按 `(Before - After) / Before x 100%` 计算。

| 指标 | A1 Before | A3 After | Reduction |
| --- | ---: | ---: | ---: |
| SQL count | 163 | 8 | **95.092%** |
| Cold Backend Avg | 1739.177 ms | 917.724 ms | **47.232%** |
| Cold Total Avg | 2015.189 ms | 1131.510 ms | **43.851%** |
| Cold Metadata Avg | 1083.398 ms | 394.759 ms | **63.563%** |
| Warm Backend Avg | 391.036 ms | 60.074 ms | **84.637%** |
| Warm Total Avg | 395.165 ms | 63.460 ms | **83.941%** |
| Warm Metadata Avg | 376.326 ms | 23.972 ms | **93.630%** |

SQL 和全部 Cold/Warm 时间指标均明显改善。Warm Metadata 的降幅最大，证明 A1 定位的 per-photographer metadata N+1 是主要瓶颈，A2 的分页前移和批量/聚合查询有效消除了该瓶颈。

## 8. 测试

A3 完成后重新执行：

```powershell
cd C:\Users\LiXiaozhou\Camera-A-ServicePackage\backend
mvn "-Dtest=ServicePackageServiceTest,ServicePackageFlowTest,ServicePackagePerformanceProbeTest,ServicePackageA2BehaviorTest,ServicePackageRepositoryPaginationTest,CreditSnapshotServiceBatchTest,CreditSnapshotBatchIntegrationTest" test
```

结果：

```text
Tests run: 43
Failures: 0
Errors: 0
Skipped: 0
BUILD SUCCESS
```

Maven 仍提示 `jacoco-maven-plugin` 重复声明；该既有告警未影响测试。部分额外 Windows Web integration tests 曾因 JDK loopback / `IpLocationService` 环境问题在 Spring Context 初始化阶段失败，没有进入业务断言，本报告不将这些环境失败描述为业务通过。

## 9. 原始本地证据

```text
OUTPUT_ROOT:
C:\Users\LiXiaozhou\Camera-A-ServicePackage\backend\target\performance\local-after-service-package-v1-20260904-153241

MATRIX_PATH:
C:\Users\LiXiaozhou\Camera-A-ServicePackage\backend\target\performance\local-after-service-package-v1-20260904-153241\local-after-service-package-v1.csv
```

证据包括：

- `local-after-service-package-v1.csv`
- `client-runs.csv`
- 12 组 Cold `*.app.log` / `*.stdout.log` / `*.stderr.log`
- 1 组 Warm session 日志
- 24 个正式响应 JSON
- 5 个不计入矩阵的 Warm-up 响应 JSON

这些原始文件位于 ignored 的 `backend/target/performance` 下，不随 Git 提交。本 Markdown 保存正式 After 结果。

## 10. Recommendation Pagination Exception

本次正式 A3 请求为默认普通 `latest` 路径，该路径已经完成数据库过滤、排序、分页和 count。

`recommend` 路径的 metadata N+1 已消除，SQL 保持固定数量级；但为了保持现有 Java 推荐评分、`Objects.hash(feedSeed, id)` 排序、顺序式去同质化和跨页语义，仍保留完整候选集和 Java pagination。`recommend` 尚未完成 DB pagination，这是经过批准的设计例外和剩余技术债，不能将 A3 的普通路径结果解释为所有排序路径均完成数据库分页。

## 11. 剩余风险与范围

- A3 数据来自固定本地数据集，不能替代生产容量和并发压测。
- Cold 定义不清 MySQL buffer pool，与 A1 完全一致，但不是数据库冷缓存测试。
- `recommend` 仍可能因完整候选集规模增长产生 Java 侧成本，后续优化必须继续优先保护推荐语义。
- A3 未修改业务代码、Repository、DTO 或 Probe 统计口径。
- A4 尚未开始。
