# A → C DATABASE DELIVERY

## Final closure update — 2026-09-10

- ServicePackage P0: DONE, PR #5 merged.
- ServicePackage 24-run Before/After: DONE.
- Demand Optimization: DONE, PR #6 merged.
- A5 phone-account schema: PR #7 merged.
- B AUTH persistence contract: frozen and integrated.
- Current-main schema sync: READY FOR REVIEW.

Current source of truth: `origin/main@b8fd50da24b407ce9904f08d4ca442e2bdb92b83`.

Final SQL chains:

- Path A: 13 scripts;
- Path B: 17 scripts;
- both include `add_auth_phone_account.sql` before `add_phone_auth_sessions.sql`;
- Path A verification: 13/13, 39 tables;
- Path B verification: 17/17, 56 tables;
- missing fresh tables/columns/semantic indexes/unique/FKs in Path B: 0;
- plaintext phone columns: 0;
- only approved common-column mismatch: legacy nullable `disputes.previous_order_status`.

C must still perform backup, real-data preflight, staging rehearsal and maintenance-window execution. Stop on duplicate `mobile_hash`, partial identity, non-empty legacy plaintext phone, `SCHEMA SYNC BLOCKED`, unsafe narrowing or unresolved dispute state. No migration may delete, overwrite, merge or fabricate business identity data.

At `b8fd50d`, Backend test/coverage/package and Frontend lint/build passed; the separate `Deploy frontend and backend` job failed. C must investigate that job before deployment. A did not change deployment configuration.

The final local `mvn test` run reported 664 tests: 382 passed, 0 failures, 280 environment errors and 2 skipped. The errors occurred during Spring Context/local HTTP-server startup under the known Windows loopback limitation (`Unable to establish loopback connection`, `Invalid argument: connect`) and did not enter business assertions. They are not represented as business passes; GitHub CI/Linux is the authoritative follow-up environment.

The original pre-A5 delivery below is retained as historical evidence and is superseded where facts differ.

---

## Historical pre-A5 delivery

## 1. A 第一阶段完成状态

- ServicePackage P0 = DONE
- ServicePackage 24-run Before/After = DONE
- Demand Optimization = DONE
- AUTH Migration Design = STARTED

A 第一阶段验收目标已经完成。当前工作是完成后的数据库/fresh-init 交付收口，不是重做 A1-A5。

## 2. 已 merge main 成果

| Deliverable | PR | Main merge commit |
|---|---:|---|
| ServicePackage P0 + benchmark evidence | #5 | `598fb40fcbf1f9ab85d2115639ffe7cfcaf9b290` |
| Demand query optimization | #6 | `30ac97323b35d1e456cb28987a634e1898c70717` |
| Current Schema Sync | pending review | not committed / PR not created |

A5 phone-account schema is Draft PR #7 and is intentionally not merged.

## 3. Current main database state

- audited main SHA: `30ac97323b35d1e456cb28987a634e1898c70717`
- fresh-init entrypoint: `backend/src/main/resources/db/V1_baseline.sql`
- migration directory: `backend/src/main/resources/db/migration/`
- formal order: `backend/src/main/resources/db/README_EXECUTION_ORDER.md`
- JPA mode: `spring.jpa.hibernate.ddl-auto=none`

The entrypoint is not a standalone complete initializer. A new database must execute every Path A step in the documented order.

## 4. Fresh-init verification

- DB: `camera_fresh_init_verify`
- MySQL: 8.0.41
- initial state: empty
- Path A scripts: 11/11 successful
- final tables: 37
- rows: 0
- current columns: verified
- indexes: verified
- unique constraints: verified
- foreign keys: verified
- `users.id`: `BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT`
- key Repository/native SQL/MyBatis statements: parse/execute successful
- Hibernate `ddl-auto=validate`: JPA EntityManagerFactory initialized
- formal `ddl-auto=none`: JPA EntityManagerFactory initialized, with no missing-table or missing-column failure

The process later stops in `IpLocationService` because the Codex Windows/JDK environment cannot create the loopback channel (`Unable to establish loopback connection`, `Invalid argument: connect`). This is not a schema failure.

Result:

`CURRENT MAIN FRESH INIT = READY`

## 5. Migration-path verification

Verification DB: `camera_schema_migration_verify`

Input:

```text
camera_app schema-only dump
→ documented Path B migrations
→ current schema
```

Controls:

- no `camera_app` DDL or data mutation;
- no business rows copied;
- exact 15-step Path B;
- stop on first SQL error;
- new idempotent sync steps rerun successfully.

Result:

- scripts: 15/15 successful
- final tables: 54
- current-main tables missing: 0
- current-main columns missing: 0
- key SQL parse: successful
- JPA `ddl-auto=validate`: EntityManagerFactory initialized before the same known Windows loopback blocker

`OLD-SCHEMA MIGRATION = PASS_WITH_DOCUMENTED_DIFFERENCES`

For real staging data, C must still run the documented preflight. The final sync migration intentionally aborts if a narrowing conversion would truncate data or a required field contains NULL.

## 6. Fresh-init vs migration equivalence

`SCHEMA_EQUIVALENCE = PASS_WITH_DOCUMENTED_DIFFERENCES`

Documented differences:

1. Path B retains 17 legacy module tables that current main does not require on a new database. They are preserved to avoid destructive migration.
2. Path B retains non-conflicting historical columns and additional indexes/FKs.
3. `disputes.previous_order_status` stays nullable on Path B until its already documented second-stage data-hardening gate.
4. The local historical schema contains three provisional `mobile_*` columns; they are not current-main released schema and are not copied into Path A.

Current-main contract coverage:

- table coverage: PASS
- common column type/null/default coverage: PASS except the approved dispute nullable gate
- semantic index coverage: PASS
- unique coverage: PASS
- FK coverage: PASS

Full evidence is in `docs/data/current-schema-sync-report.md`.

## 7. C 当前可以依赖什么

C can rely on:

- every database object currently required by main is supplied by the formal Path A chain;
- existing P3/history databases have a documented Path B that supplies the same current-main contract;
- missing provider style tables and the legacy conversation key are included in the order;
- current entity column definitions and required query indexes are synchronized;
- migration refuses unsafe truncation or fabricated NOT NULL backfill.

`CURRENT MAIN FRESH INIT = READY`

Existing-database rollout is ready for staging rehearsal, subject to backup and real-data preflight. A `SCHEMA SYNC BLOCKED` result is a release stop, not permission to rewrite rows automatically.

## 8. B 尚未合入的 Auth 内容

A5 is separate:

- Draft PR #7, open and not merged
- `mobile_cipher VARBINARY(512) NULL`
- `mobile_hash CHAR(64) NULL`
- `mobile_masked VARCHAR(32) NULL`
- `phone_verified_at DATETIME(6) NULL`
- locally verified draft
- production rollout blocked by B input

B still must freeze one-phone-one-account, normalization, hash/HMAC and key rotation, first binding, verified timing, CUSTOMER assignment, reauth, Session/JWT invalidation and logout semantics.

If AUTH-002 adds Session, SMS, auth tables, fields or indexes, B must update migration + fresh-init + execution order in the same PR. After B merges, A recommends one final database consistency audit before C deploys.

## 9. A / C 部署边界

A owns:

- schema
- migration
- indexes/constraints
- fresh-init
- isolated database verification
- database handoff evidence

C owns:

- staging backup
- secrets
- deployment tooling
- staging migration execution
- production execution
- rollback window and operational monitoring

A must not SSH to a server and manually ALTER production. C must not bypass the reviewed migration order.

## 10. C 下一步动作

Current-main path:

```text
Schema Sync review/PR
→ staging backup
→ Path A fresh-init rehearsal or Path B real-data preflight/migration
→ schema checks
→ deployment
```

Auth path:

```text
B AUTH-002 rule freeze and merge
→ A final database consistency audit
→ C staging fresh-init/migration verification
→ deployment decision
```

Do not merge or deploy Draft PR #7 until its B-line blockers are resolved and A5 is reviewed again.
