# A First Stage Final Report

Date: 2026-09-10

## 1. ServicePackage P0

Status: `DONE`

- PR #5; merge `598fb40fcbf1f9ab85d2115639ffe7cfcaf9b290`
- A1 `7ce47d11735d2dcf7395f54621c7e935245dd448`
- A2 `b2a5141e64b56bd103dd82d1c2ec9684f5dcc741`
- A3 `cf6fcc6096acb8893e2d8fdcd8ca1892ebf16a85`
- dataset: `local-service-package-perf-dataset-v1`
- SQL: 163 → 8, reduction 95.092%
- Cold Backend Avg: 1739.177 ms → 917.724 ms, reduction 47.232%
- Warm Backend Avg: 391.036 ms → 60.074 ms, reduction 84.637%
- ordinary sorts: database filtering/sorting/count/pagination complete
- recommend: metadata N+1 removed; Java pagination retained by approved exception
- focused tests: 43 passed, 0 failed, 0 errors, 0 skipped

Evidence:

- `docs/performance/service-package/local-before-service-package-v1.md`
- `docs/performance/service-package/a2-service-package-batch-optimization.md`
- `docs/performance/service-package/local-after-service-package-v1.md`

## 2. Demand Optimization

Status: `DONE`

- PR #6; commit `f95afbb6181cac420f34265a17040e5004a1c48c`
- merge `30ac97323b35d1e456cb28987a634e1898c70717`
- SQL: 24 → 3, reduction 87.5%
- User SQL: 23 → 1, reduction 95.652%
- ordinary path: database filtering/sorting/count/pagination complete
- recommend: Java ranking/diversification/pagination retained; User N+1 removed
- focused/admin tests reaching business assertions passed
- Windows loopback-blocked tests were reported separately, not as business passes

Evidence: `docs/performance/demand/a4-demand-query-optimization.md`

## 3. AUTH Database Model

Status: `STARTED AND INTEGRATED`

- PR #7; A5 head `9f05ab914a8c3011521d18f7339367f68c8c4f84`
- merge `e1d8e5e97117e3511ca3da23802db7f958744f59`
- unified A5/B integration `b8fd50da24b407ce9904f08d4ca442e2bdb92b83`
- B final contract: `FROZEN FOR INTEGRATION`

Released schema includes nullable encrypted/hash/masked/verified identity fields, `uk_users_mobile_hash`, nullable `last_login_at`, hash-only `sms_challenges`, revocable `user_sessions`, no plaintext phone, no fake legacy backfill, and unchanged `users.id`.

The former `BLOCKED BY B INPUT` state is closed. Production rollout remains subject to C's backup, real-data preflight, staging rehearsal and maintenance-window execution.

## 4. Current-main database closure

Status: `READY FOR REVIEW`

- branch: `data/schema-fresh-init-sync`
- synchronized base: `origin/main@b8fd50da24b407ce9904f08d4ca442e2bdb92b83`
- MySQL: 8.0.41
- Path A: 13/13 scripts, 39 tables
- Path B: 17/17 scripts, 56 tables
- missing Path A tables/columns/indexes/unique/FKs in Path B: 0
- plaintext phone columns: 0
- duplicate hash groups: 0 on schema-only input
- partial/inconsistent identity rows: 0 on schema-only input
- only intentional mismatch: legacy nullable `disputes.previous_order_status`

Evidence: `docs/data/current-schema-sync-report.md`

## 5. Verification

```text
mvn "-Dtest=AdminGovernanceMigrationContractTest,CurrentSchemaFreshInitContractTest,AuthPhoneSchemaMigrationContractTest,PhoneAuthSchemaContractTest" test
```

- tests run: 18
- failures: 0
- errors: 0
- skipped: 0

Full local backend regression:

```text
mvn test
```

- tests run: 664
- passed: 382
- failures: 0
- errors: 280
- skipped: 2
- build: FAILURE

All 280 errors are recorded as environment-blocked, not as business passes. They occurred during Spring Context or local HTTP-server initialization under the known Codex Windows loopback limitation (`Unable to establish loopback connection`, `Invalid argument: connect`). Thirteen Surefire report files contain those signatures; affected tests did not reach business assertions. No temporary HTTP transport workaround was added to the closure changes.

Latest main checks:

- Backend test/coverage/package: SUCCESS
- Frontend lint/build: SUCCESS
- Vercel: SUCCESS
- Deploy frontend and backend: FAILURE, not reported as a pass

## 6. Git and ownership

- closure work is isolated in `C:\Users\LiXiaozhou\Camera-A-SchemaSync`
- original-workspace review/credit changes were not modified
- SchemaSync changed no Auth business logic, frontend, deployment, HarmonyOS, payment or KYC behavior
- no SchemaSync commit, push or merge has been performed at report time

## 7. Remaining risks

- C must investigate the failed deploy workflow before deployment.
- C must back up staging/production and run every real-data gate before Path B.
- Schema-only verification cannot prove live rows satisfy duplicate/partial/plaintext/narrowing gates.
- `disputes.previous_order_status` remains nullable on the historical path until its approved hardening window.
- Path B intentionally retains 17 historical-only tables and extra compatible objects.
- Live Hibernate `ddl-auto=validate` was not rerun with the masked CLI credential; SQL equivalence, contract tests and Backend CI are the current evidence.

## 8. First-stage acceptance

```text
ServicePackage P0       DONE
24-run After            DONE
Demand Optimization     DONE
AUTH Migration Design   STARTED AND INTEGRATED
Database Schema Sync    READY FOR REVIEW
```

`A FIRST STAGE = READY FOR FINAL REVIEW`
