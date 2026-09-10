# Current Main Schema Sync Report

## Final closure addendum — 2026-09-10

This addendum is the authoritative final state. The 2026-09-05 body below is retained as historical evidence of the pre-A5/B audit and is superseded where facts differ.

### Synchronized source

- branch: `data/schema-fresh-init-sync`
- synchronized `origin/main`: `b8fd50da24b407ce9904f08d4ca442e2bdb92b83`
- A5 PR #7 merge: `e1d8e5e97117e3511ca3da23802db7f958744f59`
- unified A5/B AUTH integration: `b8fd50da24b407ce9904f08d4ca442e2bdb92b83`
- B contract: `docs/data/b-auth-final-contract.md`, `FROZEN FOR INTEGRATION`

The former A5/B-input blocker is closed. This SchemaSync change does not modify Auth business logic, frontend, deployment, HarmonyOS, payment or KYC behavior.

### Final execution chains

`FRESH_INIT_ENTRYPOINT = backend/src/main/resources/db/V1_baseline.sql`. The entrypoint is not a complete initializer.

Path A now has 13 ordered scripts. The historical 11 steps remain, with the released AUTH migrations followed by the provider-style catalog:

11. `migration/add_auth_phone_account.sql`
12. `migration/add_phone_auth_sessions.sql`
13. `migration/add_provider_style_catalog.sql`

Path B now has 17 ordered scripts. After its historical first 12 steps:

13. `migration/add_auth_phone_account.sql`
14. `migration/add_phone_auth_sessions.sql`
15. `conversations_messages.sql`
16. `migration/add_provider_style_catalog.sql`
17. `migration/sync_current_main_schema.sql`

The account migration precedes the session migration in both paths. Neither path stores a plaintext phone.

### Final MySQL verification

MySQL: 8.0.41. Both databases use `utf8mb4 / utf8mb4_0900_ai_ci`.

Path A — `camera_fresh_init_verify`:

- empty input database;
- scripts: 13/13 successful;
- tables: 39;
- users rows: 0;
- phone identity/login columns: 5/5;
- plaintext `users.phone` / `sms_challenges.phone` columns: 0;
- AUTH tables: 2/2;
- provider style tables: 2/2;
- key repeatable scripts rerun: 4/4 successful;
- `users.id`: `BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT`.

Path B — `camera_schema_migration_verify`:

- input: schema-only local `camera_app` dump with no business rows and no `USE camera_app`;
- scripts: 17/17 successful;
- tables: 56;
- users rows: 0;
- duplicate mobile-hash groups: 0;
- partial/inconsistent identity rows: 0;
- plaintext `users.phone` / `sms_challenges.phone` columns: 0;
- AUTH tables: 2/2;
- provider style tables: 2/2;
- key repeatable scripts rerun: 5/5 successful;
- `users.id`: `BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT`.

No verification command altered `camera_app`.

### Final equivalence

`SCHEMA_EQUIVALENCE = PASS_WITH_DOCUMENTED_DIFFERENCES`

- missing Path A tables in Path B: 0;
- missing Path A columns in Path B: 0;
- semantically missing Path A indexes in Path B: 0;
- missing Path A unique signatures in Path B: 0;
- missing Path A foreign-key signatures in Path B: 0;
- common-column definition mismatches: 1.

The one approved mismatch remains `disputes.previous_order_status`: Path A is `NOT NULL`; Path B remains nullable until historical disputes are resolved/backfilled and a separate maintenance-window hardening step is approved.

Path B intentionally retains 17 historical-only tables and additional compatible schema objects.

Final counts:

- Path A non-primary indexes: 95;
- Path B non-primary indexes: 191;
- Path A non-primary unique indexes: 23;
- Path B non-primary unique indexes: 44;
- Path A foreign keys: 13;
- Path B foreign keys: 103.

### Final contract tests

```text
mvn "-Dtest=AdminGovernanceMigrationContractTest,CurrentSchemaFreshInitContractTest,AuthPhoneSchemaMigrationContractTest,PhoneAuthSchemaContractTest" test
```

- tests run: 18;
- failures: 0;
- errors: 0;
- skipped: 0;
- build: SUCCESS.

The SchemaSync test was verified red before the execution-order merge, then green after integration.

### Full local backend regression

```text
mvn test
```

- tests run: 664;
- passed: 382;
- failures: 0;
- errors: 280;
- skipped: 2;
- build: FAILURE.

The 280 errors are not reported as business passes. They occurred during Spring Context or local HTTP-server initialization in the Codex Windows environment. Thirteen Surefire report files contain both `Unable to establish loopback connection` and `Invalid argument: connect`; affected suites did not reach their business assertions. No Windows transport workaround was reintroduced. Current-main Backend CI remains the required Linux-environment regression evidence.

At `origin/main@b8fd50d`, Backend test/coverage/package and Frontend lint/build passed. The separate `Deploy frontend and backend` job failed and is not reported as a database pass.

### Final release boundary

`CURRENT MAIN FRESH INIT = READY`

`OLD-SCHEMA MIGRATION = PASS_WITH_DOCUMENTED_DIFFERENCES`

`A FIRST-STAGE DATABASE CLOSURE = READY FOR REVIEW`

B input is no longer a blocker. Production remains a C-owned gate: backup, real-data preflight, staging rehearsal and maintenance-window execution are still mandatory. This local run used a schema-only historical snapshot and does not claim that staging or production rows pass duplicate-hash, partial-identity, plaintext-phone, narrowing or unresolved-dispute gates.

Live Hibernate `ddl-auto=validate` was not rerun because the CLI Login Path intentionally does not expose the JDBC password. SQL equivalence, migration contract tests and current-main Backend CI provide the local final evidence.

Final local evidence:

- `backend/target/schema-sync/camera_app-schema-before.sql`
- `backend/target/schema-sync/pre-main-sync/README_EXECUTION_ORDER.local-before-b8fd50d.md`
- `backend/target/surefire-reports`

Files under `backend/target` remain ignored local evidence.

---

## Historical pre-A5/B audit — retained unchanged

Date: 2026-09-05

## 1. Scope and source of truth

This closure audits the database contract of:

- branch: `data/schema-fresh-init-sync`
- worktree: `C:\Users\LiXiaozhou\Camera-A-SchemaSync`
- base and current `origin/main`: `30ac97323b35d1e456cb28987a634e1898c70717`
- ServicePackage merge: PR #5, `598fb40fcbf1f9ab85d2115639ffe7cfcaf9b290`
- Demand merge: PR #6, `30ac97323b35d1e456cb28987a634e1898c70717`

Authoritative facts were taken from current main Java entities, Spring Data repositories, native SQL, MyBatis mappers, SQL under `backend/src/main/resources/db`, and `README_EXECUTION_ORDER.md`. Historical design documents were not treated as released schema.

`spring.jpa.hibernate.ddl-auto=none` is declared in `backend/src/main/resources/application.yml`. Therefore every table, column and access-path constraint required by current main must be provided by SQL.

This work does not redo A1-A4, modify application behavior, or merge the provisional A5 phone-account contract.

## 2. Formal fresh-init entrypoint and chains

`FRESH_INIT_ENTRYPOINT = backend/src/main/resources/db/V1_baseline.sql`

Path A, fresh database:

1. `V1_baseline.sql`
2. `certification.sql`
3. `V3_b1_b2_fresh.sql`
4. `conversations_messages.sql`
5. `V5_d_line_fresh.sql`
6. `moments.sql`
7. `migration/add_admin_governance.sql`
8. `migration/add_dual_identity_fields.sql`
9. `migration/alter_moment_images_image_data.sql`
10. `migration/add_user_profile_visibility.sql`
11. `migration/add_provider_style_catalog.sql`

Path B, P3/history database:

1. `migration/fix_disputes_refund_amount_type.sql`
2. `b1_b2_persistence.sql`
3. `d_line_backend.sql`
4. `certification_compat.sql`
5. `local_patch_camera_app_missing_schema.sql`
6. `local_patch_camera_app_certification_disputes_sync.sql`
7. `migration/add_dual_identity_fields.sql`
8. `migration/alter_moment_images_image_data.sql`
9. `migration/add_user_profile_visibility.sql`
10. `migration/add_payment_order_unique_constraint.sql`
11. `migration/add_dispute_previous_order_status.sql`
12. `migration/add_admin_governance.sql`
13. `conversations_messages.sql`
14. `migration/add_provider_style_catalog.sql`
15. `migration/sync_current_main_schema.sql`

## 3. Audit matrix

`Verified` means the required key/index/constraint is present in Path A and is present by the same signature or a semantically covering historical signature after Path B.

| Table | Entity/Repository | Fresh-init | Migration | Index | Unique | FK | Status |
|---|---|---|---|---|---|---|---|
| users | User, auth/admin repositories | V1 + visibility | dual identity + sync | Verified | student_no | Current contract verified | FIXED |
| roles | No current entity/repository | Not created | Not created | — | — | — | INTENTIONAL_DIFFERENCE |
| user_role_bindings | UserRoleBinding/admin query | V1 | historical + dual identity | Verified | user_id/role | Current contract verified | MATCH |
| files | FileRecord/repositories | V1 | sync | Verified | file_key | Current contract verified | FIXED |
| credit_records | CreditRecord/repositories | V1 | D-line + sync | Verified | source_type/source_id | Current contract verified | FIXED |
| quotes | Quote/repositories | V1 | sync | Verified | quote_no | Current contract verified | FIXED |
| orders | Order/repositories | V1 | sync | Verified | order_no | Current contract verified | FIXED |
| order_status_logs | OrderStatusLog | V1 | historical | Verified | — | Current contract verified | MATCH |
| payment_records | PaymentRecord | V1 | payment unique + sync | Verified | payment_no, order_id | Current contract verified | FIXED |
| disputes | Dispute/admin arbitration | V1 | previous status + sync | Verified | — | Current contract verified | FIXED |
| dispute_replies | DisputeReply | V1 | sync | Verified | — | Current contract verified | FIXED |
| deliveries | Delivery | V1 | sync | Verified | — | Current contract verified | FIXED |
| delivery_files | DeliveryFile | V1 | sync | Verified | — | Current contract verified | FIXED |
| photo_authorizations | PhotoAuthorization | V1 | sync | Verified | — | Current contract verified | FIXED |
| photo_authorization_files | PhotoAuthorizationFile | V1 | historical | Verified | — | Current contract verified | MATCH |
| student_certifications | StudentCertification | V1 | sync | Verified | Current contract verified | Current contract verified | FIXED |
| real_name_certifications | RealNameCertification/MyBatis | certification | compatibility + sync | Verified | Current contract verified | Current contract verified | FIXED |
| audit_records | AuditRecord | certification | governance/history | Verified | — | Current contract verified | MATCH |
| provider_profiles | ProviderProfileMapper | certification + dual identity | dual identity + sync | Verified | user_id | Current contract verified | FIXED |
| style_tags | ProviderProfileMapper | style catalog | style catalog | Verified | name | tag relation | FIXED |
| provider_style_tags | ProviderStyleTagMapper | style catalog | style catalog | Verified | profile/tag | two required FKs | FIXED |
| service_packages | ServicePackage/admin hall | V3 + governance | B1/B2 + governance + sync | Verified | Current contract verified | Current contract verified | FIXED |
| service_package_interests | ServicePackageInterest | V3 | historical/B1-B2 | Verified | user/package | Current contract verified | MATCH |
| demands | Demand/admin hall | V3 + governance | B1/B2 + governance | Verified | Current contract verified | Current contract verified | MATCH |
| demand_responses | DemandResponse | V3 | B1/B2 + sync | Verified | demand/provider | Current contract verified | FIXED |
| conversations | Conversation | conversations | conversations sync | Verified | five-column conversation key | Current contract verified | FIXED |
| messages | Message | conversations | conversations sync | Verified | client_message_id | Current contract verified | MATCH |
| conversation_hidden_by_user | ConversationHiddenByUser | conversations | conversations sync | Verified | conversation/user | two required FKs | MATCH |
| reviews | Review | V5 | D-line + sync | Verified | order/direction | Current contract verified | FIXED |
| review_complaints | ReviewComplaint | V5 | D-line + sync | Verified | Current contract verified | Current contract verified | FIXED |
| notifications | Notification | V5 | D-line + sync | Verified | dedupe_key | Current contract verified | FIXED |
| moment_posts | MomentPost/admin governance | moments + governance | moments/history + governance | Verified | Current contract verified | Current contract verified | MATCH |
| moment_images | MomentImage | moments + image migration | image migration | Verified | Current contract verified | Current contract verified | MATCH |
| moment_likes | social repositories | moments | moments/history | Verified | user/post | Current contract verified | MATCH |
| moment_favorites | social repositories | moments | moments/history | Verified | user/post | Current contract verified | MATCH |
| moment_mentions | social repositories | moments | moments/history | Verified | Current contract verified | Current contract verified | MATCH |
| user_follows | UserFollow | moments + dual identity | dual identity | Verified | follower/target/role | Current contract verified | MATCH |
| reports | Report/admin query | governance | governance | Verified | active_dedupe_key | Current contract verified | MATCH |

Audit totals for the 37-table current-main contract:

- MATCH: 15
- FIXED: 22
- BLOCKED: 0
- `roles`: intentional absence because current main uses `users.current_role` and `user_role_bindings`, with no `roles` table access.

## 4. Fixes

### 4.1 Missing mapper tables

Current `ProviderProfileMapper.xml` and `ProviderStyleTagMapper.java` access `style_tags` and `provider_style_tags`, but the formal fresh chain did not create them. `add_provider_style_catalog.sql` now creates the current P3-compatible definitions, unique constraints, indexes and foreign keys and is present in both paths.

### 4.2 Legacy conversation key

Path B now runs `conversations_messages.sql`. This aligns the released five-column conversation unique key, including `order_id`, without creating a parallel migration system.

### 4.3 Legacy column definitions and access indexes

`sync_current_main_schema.sql` aligns the current-main definitions for:

- `credit_records`, `deliveries`, `delivery_files`
- `dispute_replies`, `disputes`, `files`, `notifications`
- `orders`, `payment_records`, `photo_authorizations`
- `provider_profiles`, `quotes`, `real_name_certifications`
- `review_complaints`, `reviews`, `service_packages`
- `student_certifications`, `users`

It adds only current-main query indexes that lacked an equivalent Path B access path:

- `idx_demand_responses_current(demand_id, status, response_time)`
- `idx_disputes_initiator_status(initiator_id, status)`
- `idx_disputes_status_created(status, created_at)`
- `idx_orders_status_created(status, created_at)`
- `idx_payment_records_status(status)`
- `idx_photo_auth_provider_status(provider_user_id, status)`
- `idx_users_status(status)`

The migration does not update or delete business rows. Every text narrowing is guarded by a maximum-length assertion; every nullable-to-required change is guarded by a NULL assertion. Incompatible historical data aborts with `SQLSTATE 45000` and `SCHEMA SYNC BLOCKED`.

## 5. Fresh-init verification

- database: `camera_fresh_init_verify`
- MySQL: 8.0.41
- charset/collation: utf8mb4 / utf8mb4_0900_ai_ci database default
- initialization: exact 11-step Path A from an empty database
- scripts: 11/11 successful
- tables: 37
- rows: 0
- `users.id`: `BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT`
- current required indexes: verified
- unique constraints: verified
- foreign keys: verified
- key Demand, ServicePackage, ProviderProfile/style and admin-report SQL: parsed and executed successfully with empty results

With `ddl-auto=validate`, Hibernate connected to MySQL 8.0.41 and initialized the JPA `EntityManagerFactory`. With the formal `ddl-auto=none` setting, it also initialized the JPA `EntityManagerFactory` without a missing-table or missing-column error. In both runs, later Spring Context creation was stopped by the known Windows/JDK loopback failure in `IpLocationService`:

- `Unable to establish loopback connection`
- `Invalid argument: connect`

This is a Windows sandbox network/client initialization error, not a database schema error.

## 6. Old-schema migration verification

- database: `camera_schema_migration_verify`
- source: schema-only dump of local `camera_app`
- source evidence: `backend/target/schema-sync/camera_app-schema-before.sql`
- business data copied: none
- Path B: exact 15-step chain
- scripts: 15/15 successful
- tables after migration: 54
- rows: 0
- new idempotent scripts rerun: 3/3 successful
- `users.id`: `BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT`
- Hibernate `ddl-auto=validate`: JPA `EntityManagerFactory` initialized; the later failure was the same Windows loopback error
- key Repository/Mapper SQL: parsed and executed successfully

## 7. Equivalence

`SCHEMA_EQUIVALENCE = PASS_WITH_DOCUMENTED_DIFFERENCES`

For every current-main table:

- missing Path A tables in Path B: 0
- missing Path A columns in Path B: 0
- type/nullability/default/extra mismatches: 1
- semantically missing Path A indexes in Path B: 0
- missing Path A unique signatures in Path B: 0
- missing Path A foreign keys in Path B: 0

The one current-column difference is intentional:

- `disputes.previous_order_status`: Path A is `NOT NULL`; Path B remains nullable. The existing migration and execution-order gate explicitly defer `NOT NULL` until all historical disputes are resolved/backfilled and a later maintenance window is approved.

The migrated historical database is a superset:

- Path A tables: 37
- Path B tables: 54
- Path B-only historical tables: `demand_reference_files`, `demand_response_portfolios`, `demand_style_tags`, `dispute_evidence_files`, `dispute_reply_files`, `idempotency_records`, `portfolio_images`, `portfolio_work_tags`, `portfolio_works`, `review_images`, `review_report_files`, `review_reports`, `schedules`, `service_package_available_dates`, `service_package_tags`, `shooting_plan_templates`, `shooting_plans`.

Those tables and their historical indexes/foreign keys are retained to avoid destructive migration. Current main does not require them for fresh initialization.

Path B also retains non-conflicting historical columns in `audit_records`, `demand_responses`, `demands`, `disputes`, `real_name_certifications` and `service_packages`. They are not removed because removal would be destructive and current-main queries do not depend on their absence.

The local historical schema already contains `users.mobile_cipher`, `users.mobile_hash` and `users.mobile_masked`, but current main and Path A do not. They remain a P3-history compatibility superset, not a released A5 contract. `phone_verified_at` and the A5 execution step are deliberately absent.

## 8. Index, unique and foreign-key results

`INDEX SYNC = PASS`

- Path A non-primary indexes: 86
- Path B non-primary indexes: 183
- every Path A index is covered by the same column signature or a left-prefix/equivalent unique Path B index
- Path B retains additional historical indexes

`UNIQUE SYNC = PASS`

- Path A non-primary unique indexes: 20
- Path B non-primary unique indexes: 42
- no Path A unique signature is missing

`FK SYNC = PASS`

- Path A FK column mappings: 13
- Path B FK column mappings: 103
- no Path A FK mapping is missing; additional historical FKs are retained

## 9. Migration contract tests

Applicable tests on current main:

- `AdminGovernanceMigrationContractTest`
- `CurrentSchemaFreshInitContractTest`

`AuthPhoneSchemaMigrationContractTest` is only on independent Draft PR #7 and was not cherry-picked.

Command:

```text
mvn "-Dtest=AdminGovernanceMigrationContractTest,CurrentSchemaFreshInitContractTest" test
```

Result:

- tests run: 9
- failures: 0
- errors: 0
- skipped: 0
- build: SUCCESS

## 10. A5 relationship and deployment gate

A5 remains independent:

- Draft PR: #7
- head: `data/auth-phone-schema@9f05ab914a8c3011521d18f7339367f68c8c4f84`
- status: open draft, not merged
- design: locally verified
- production rollout: blocked by B input

The phone-account draft is not added to current-main Path A or Path B by this closure.

`CURRENT MAIN FRESH INIT = READY`

For an existing database, C must still run Path B in a backed-up maintenance window. `sync_current_main_schema.sql` can intentionally stop on incompatible real rows; such rows require explicit review, never automatic destructive repair.

## 11. Local evidence

- schema-only historical input: `backend/target/schema-sync/camera_app-schema-before.sql`
- Maven reports: `backend/target/surefire-reports`
- generated build/probe output: `backend/target`

Files under `backend/target` are ignored local evidence and are not part of Git delivery.
