# GET /service-packages A1 Before Performance Baseline

## Baseline identity

- Baseline name: `local-before-service-package-v1`
- Date: 2026-09-03
- Branch: `perf/service-package-batch`
- Base HEAD: `7a8ae09 Merge pull request #4 from yueyue0218/codex/admin-governance-backend`
- Scope: Gate 0 + A1 only
- Endpoint: `GET /service-packages?page=1&size=10`
- Result: 24/24 measured requests succeeded

This document is the tracked, formal record of the A1 Before baseline. The raw CSV,
responses, application logs, SQL logs, dataset seed, runner, and dataset manifest are
stored below `backend/target/performance`. Those files are ignored local evidence and
are not committed to Git.

## Environment

| Item | Value |
| --- | --- |
| OS | Microsoft Windows 11 Home Chinese, 64-bit, 10.0.26200 |
| JDK | Oracle JDK 17.0.12 |
| Maven | Apache Maven 3.9.16 |
| Database server | MySQL 8.0.41 on `127.0.0.1:3306` |
| Benchmark database | `camera_perf_a1` |
| Character set | `utf8mb4` |
| Collation | `utf8mb4_0900_ai_ci` |
| Dataset ID | `local-service-package-perf-dataset-v1` |
| Dataset seed SHA-256 | `58498B10904AF0E9454368179CC3869584E66BF50CF4105C24325DA17CC3A7DE` |
| Page | 1 |
| Page size | 10 |

The benchmark database was initialized by Path A from
`backend/src/main/resources/db/README_EXECUTION_ORDER.md`. All ten official schema
scripts completed in the documented order. No manual columns were added. The runner
overrode the application datasource URL to `camera_perf_a1`; the existing
`camera_app` database was not modified.

### Frozen dataset

| Data | Count / state |
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

The 36 reviews intentionally consist of 27 visible reviews used by the provider
credit snapshots plus 9 reviews hidden by completed complaint arbitration. The final
nine orders are `REFUNDED` with `REFUNDED_PROVIDER_FAULT`, matching their resolved
`FULL_REFUND` / `PROVIDER_FAULT` disputes. This keeps the frozen dataset consistent
with the current review, complaint, dispute, and order state rules.

## GET /service-packages call chain

```text
ServicePackageController.listServices
  -> ServicePackageService.listServices
  -> ServicePackageRepository.findByStatus(ONLINE)
  -> in-memory visibility/filtering
  -> ServicePackageService.photographerInfos(all base candidates)
       -> for each distinct provider
          -> UserRepository.findById
          -> ProviderProfileMapper.selectOne
          -> CreditSnapshotService.getDisplayCreditScore
               -> ReviewRepository.findByTargetUserIdAndIsVisibleTrueOrderByCreatedAtDesc
               -> OrderRepository.findAllById
               -> ReviewComplaintRepository.countByRespondentIdAndStatusAndArbitrationResult
               -> DisputeRepository.countResponsibleResolvedDisputesForUser
  -> in-memory keyword filtering and sorting
  -> ServicePackageMapper.toCard
  -> in-memory page subList
```

The ServicePackage DTO mapper does not query the database. The repeated queries are
created while loading metadata and credit snapshots for each distinct provider.

## Measurement method

- Cold: start a new backend JVM for each measured request, then stop it and wait for
  the port to be released. Twelve measured runs.
- Warm: start one backend JVM, execute five unmeasured warm-up requests, then execute
  twelve measured requests in the same JVM.
- Each request carries a unique `X-Performance-Run-Id`.
- Hibernate statement counts come from the active `SessionFactory` statistics delta.
- MyBatis counts come from `ProviderProfileMapper` `Preparing:` log entries associated
  with the same Run ID.
- Backend time is measured inside the request Probe.
- Total time is measured by the HTTP client.
- Metadata time covers `photographerInfos(baseCandidates)`.
- All formal response files were parsed and verified as HTTP 200, business code 200,
  ten returned records, and total 54.

## Complete 24-run matrix

| Run ID | Phase | SQL | Hibernate | MyBatis | Backend ms | Total ms | Metadata ms | Candidates | Photographers | HTTP | Business | Records | Success |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| cold-01 | Cold | 163 | 136 | 27 | 1847.720 | 2165.278 | 1190.791 | 54 | 27 | 200 | 200 | 10 | Yes |
| cold-02 | Cold | 163 | 136 | 27 | 1722.370 | 1924.663 | 1135.491 | 54 | 27 | 200 | 200 | 10 | Yes |
| cold-03 | Cold | 163 | 136 | 27 | 1632.521 | 1920.514 | 1038.923 | 54 | 27 | 200 | 200 | 10 | Yes |
| cold-04 | Cold | 163 | 136 | 27 | 1910.926 | 2313.797 | 1131.192 | 54 | 27 | 200 | 200 | 10 | Yes |
| cold-05 | Cold | 163 | 136 | 27 | 1739.548 | 2109.406 | 1136.333 | 54 | 27 | 200 | 200 | 10 | Yes |
| cold-06 | Cold | 163 | 136 | 27 | 2004.802 | 2346.325 | 1127.292 | 54 | 27 | 200 | 200 | 10 | Yes |
| cold-07 | Cold | 163 | 136 | 27 | 1764.276 | 1913.993 | 1050.859 | 54 | 27 | 200 | 200 | 10 | Yes |
| cold-08 | Cold | 163 | 136 | 27 | 1198.131 | 1290.070 | 813.743 | 54 | 27 | 200 | 200 | 10 | Yes |
| cold-09 | Cold | 163 | 136 | 27 | 1650.375 | 1949.886 | 1078.321 | 54 | 27 | 200 | 200 | 10 | Yes |
| cold-10 | Cold | 163 | 136 | 27 | 1737.731 | 1955.710 | 1141.004 | 54 | 27 | 200 | 200 | 10 | Yes |
| cold-11 | Cold | 163 | 136 | 27 | 1711.689 | 2038.683 | 1058.882 | 54 | 27 | 200 | 200 | 10 | Yes |
| cold-12 | Cold | 163 | 136 | 27 | 1950.031 | 2253.938 | 1097.945 | 54 | 27 | 200 | 200 | 10 | Yes |
| warm-01 | Warm | 163 | 136 | 27 | 444.273 | 450.119 | 426.542 | 54 | 27 | 200 | 200 | 10 | Yes |
| warm-02 | Warm | 163 | 136 | 27 | 424.442 | 430.248 | 406.739 | 54 | 27 | 200 | 200 | 10 | Yes |
| warm-03 | Warm | 163 | 136 | 27 | 414.020 | 419.567 | 397.767 | 54 | 27 | 200 | 200 | 10 | Yes |
| warm-04 | Warm | 163 | 136 | 27 | 450.764 | 454.930 | 435.759 | 54 | 27 | 200 | 200 | 10 | Yes |
| warm-05 | Warm | 163 | 136 | 27 | 340.029 | 343.722 | 324.773 | 54 | 27 | 200 | 200 | 10 | Yes |
| warm-06 | Warm | 163 | 136 | 27 | 389.498 | 393.242 | 375.936 | 54 | 27 | 200 | 200 | 10 | Yes |
| warm-07 | Warm | 163 | 136 | 27 | 382.259 | 385.123 | 371.139 | 54 | 27 | 200 | 200 | 10 | Yes |
| warm-08 | Warm | 163 | 136 | 27 | 375.118 | 378.002 | 361.908 | 54 | 27 | 200 | 200 | 10 | Yes |
| warm-09 | Warm | 163 | 136 | 27 | 396.065 | 400.197 | 382.890 | 54 | 27 | 200 | 200 | 10 | Yes |
| warm-10 | Warm | 163 | 136 | 27 | 359.989 | 363.060 | 349.068 | 54 | 27 | 200 | 200 | 10 | Yes |
| warm-11 | Warm | 163 | 136 | 27 | 345.412 | 348.657 | 330.314 | 54 | 27 | 200 | 200 | 10 | Yes |
| warm-12 | Warm | 163 | 136 | 27 | 370.567 | 375.110 | 353.078 | 54 | 27 | 200 | 200 | 10 | Yes |

## Timing summary

All values are milliseconds.

| Phase / metric | Min | Average | Median | P95 | Max |
| --- | ---: | ---: | ---: | ---: | ---: |
| Cold Backend | 1198.131 | 1739.177 | 1738.639 | 1974.678 | 2004.802 |
| Cold Total | 1290.070 | 2015.189 | 1997.197 | 2328.435 | 2346.325 |
| Cold Metadata | 813.743 | 1083.398 | 1112.619 | 1163.408 | 1190.791 |
| Warm Backend | 340.029 | **391.036** | 385.879 | 447.194 | 450.764 |
| Warm Total | 343.722 | **395.165** | 389.183 | 452.284 | 454.930 |
| Warm Metadata | 324.773 | **376.326** | 373.538 | 430.690 | 435.759 |

## SQL count and exclusive classification

Every measured run produced the same counts:

- Total SQL: **163**
- Hibernate: **136**
- MyBatis: **27**

Exclusive classification, assigning each statement to exactly one category:

| Category | Count per request |
| --- | ---: |
| ServicePackage / Other | 1 |
| User | 27 |
| ProviderProfile | 27 |
| Review | 27 |
| Order | 27 |
| ReviewComplaint | 27 |
| Dispute | 27 |
| **Total** | **163** |

The CSV's diagnostic `OrderQueryCount` also matches `orders` when it appears in the
Dispute query's JOIN and can therefore display 54. The exclusive classification above
assigns that joined statement to Dispute only. Direct Order queries are 27, and the
exclusive total is 163.

## Root cause

The primary problem is a stable N+1 metadata query chain:

1. The repository loads all 54 ONLINE ServicePackage rows instead of a database page.
2. Visibility and request filters are applied in memory.
3. Metadata is loaded for all 27 distinct providers before page slicing, although the
   response contains only ten packages.
4. Each provider causes one User, ProviderProfile, Review, Order, ReviewComplaint, and
   Dispute query.
5. Keyword matching, sorting, DTO conversion, and final pagination also happen after
   the full candidate set has been materialized.

This produces the stable relationship `1 + (27 x 6) = 163`. Warm metadata averages
376.326 ms, approximately 96% of the 391.036 ms average Warm backend time. The
metadata query chain is therefore the dominant measured backend cost.

Current pagination is not database pagination. Moving the page boundary earlier must
preserve visibility, JSON tag/date filtering, keyword matching, recommendation rules,
sorting, and total-count semantics.

## Tests and validation

Command:

```powershell
cd C:\Users\LiXiaozhou\Camera-A-ServicePackage\backend
mvn "-Dtest=ServicePackageServiceTest,ServicePackageFlowTest,ServicePackagePerformanceProbeTest" test
```

Result:

- Tests run: 28
- Passed: 28
- Failures: 0
- Errors: 0
- Skipped: 0
- Maven result: `BUILD SUCCESS`
- Existing build warning: duplicate `jacoco-maven-plugin` declaration. It did not
  affect this test run and is outside the A1 scope.

`git diff --check` completed with exit code 0. It printed only the working-copy line
ending warning for `ServicePackageService.java` (`LF will be replaced by CRLF the next
time Git touches it`).

## Raw local evidence

Ignored local evidence root:

```text
C:\Users\LiXiaozhou\Camera-A-ServicePackage\backend\target\performance\local-before-service-package-v1-20260903-201050
```

Files:

- Matrix: `local-before-service-package-v1.csv`
- Client matrix: `client-runs.csv`
- Application and SQL logs: `*.app.log`
- Standard output/error: `*.stdout.log`, `*.stderr.log`
- Response bodies: `responses/*.json`
- Dataset manifest:
  `backend/target/performance/local-service-package-perf-dataset-v1.manifest.txt`
- Dataset SQL and runner are also under `backend/target/performance`.

These are deliberately ignored and local only. They are not part of the Git commit;
this Markdown file preserves the formal baseline measurements.

## Historical reference comparison

| Metric | Historical reference | Current A1 baseline | Difference |
| --- | ---: | ---: | ---: |
| SQL count | approximately 139 | 163 | +24 / approximately +17.3% |
| Warm Backend | approximately 421 ms | 391.036 ms average | approximately -7.1% |
| Warm Metadata | approximately 352 ms | 376.326 ms average | approximately +6.9% |

The exact historical SQL count is not reproduced because the current code path and
frozen dataset trigger the Order query for every provider. The underlying issue is
nevertheless reproduced consistently: all 24 measured runs exhibit the same N+1
shape and the same 163 SQL statements.

## Proposed A2 plan — not executed

```text
ServicePackage database Page
  -> photographerIds
  -> batch User
  -> batch ProviderProfile
  -> Review aggregation
  -> Order aggregation
  -> ReviewComplaint aggregation
  -> Dispute aggregation
  -> Maps
  -> DTO
```

Expected areas for review in A2:

- `ServicePackageService`
- `ServicePackageRepository`
- `UserRepository`
- `ProviderProfileMapper`
- `ReviewRepository`
- `OrderRepository`
- `ReviewComplaintRepository`
- `DisputeRepository`
- ServicePackage service, flow, repository, and performance tests

The response DTO contract should not change. Public visibility, moderation status,
filtering, ordering, recommendation, page, and total-count behavior must remain
unchanged. A preliminary target is to reduce the fixed query count from 163 to about
eight statements, subject to correctness-first implementation and an After baseline.

A2 has not started.
