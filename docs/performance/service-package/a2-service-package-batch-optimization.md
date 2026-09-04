# A2 Service Package Batch Optimization

## 1. Baseline reference

- A1 commit: `7ce47d11735d2dcf7395f54621c7e935245dd448`
- Dataset: `local-service-package-perf-dataset-v1`
- Benchmark database: `camera_perf_a1`
- Before SQL count: `163`
- Before Warm Backend Avg: `391.036 ms`
- Before Warm Metadata Avg: `376.326 ms`

The A1 baseline represents one ServicePackage query followed by six per-photographer query families for 27 photographers: `1 + 27 x 6 = 163` SQL statements.

## 2. Main query optimization

### Before

```text
all ONLINE packages
-> Java filtering
-> Java sorting
-> per-photographer metadata loading
-> DTO mapping
-> Java pagination
```

### After: ordinary sorts

```text
database filtering
-> database sorting
-> database pagination
-> database count
-> current page only
-> batch metadata loading
-> DTO mapping
```

Database filtering, sorting, and pagination are complete for:

- `latest`
- `price_asc`
- `price_desc`
- `created_asc`

The public visibility contract remains `status = ONLINE`, `moderation_status = VISIBLE`, and `hidden_by_provider = false`. Existing page/size behavior and filtering semantics are retained.

## 3. SQL optimization

### Before

```text
ServicePackage: 1
User: 27
ProviderProfile: 27
Review: 27
Order: 27
ReviewComplaint: 27
Dispute: 27
Total: 1 + 27 x 6 = 163
```

### After: ordinary path

```text
ServicePackage page/count: 2
User:                      1
ProviderProfile:           1
Review:                    1
Order:                     1
ReviewComplaint:           1
Dispute:                   1
Total:                     8
```

### After: recommend path

```text
ServicePackage:    1
User:              1
ProviderProfile:   1
Review:            1
Order:             1
ReviewComplaint:   1
Dispute:           1
Total:             7
```

The query count is fixed by query family and no longer grows linearly with photographer count.

## 4. Repository and aggregation implementation

### ServicePackage query

- `ServicePackageRepository.findPublicPage(...)`
  - Native SQL data query plus count query.
  - Applies public visibility, keyword, city, scene, style, price, date, and time-tag filters in the database.
  - Applies ordinary sort ordering with deterministic ID secondary ordering.
  - Uses Spring Data `Pageable` for database pagination.

### Credit aggregation

- `ReviewRepository.findCreditAggregates(...)`
  - JPQL grouped query for visible review count, positive review count, average rating, and distinct effective order count.
- `OrderRepository.findCompletedReviewedOrderCounts(...)`
  - JPQL grouped query for completed reviewed order count.
- `ReviewComplaintRepository.findResponsibleComplaintCounts(...)`
  - JPQL grouped query for responsible resolved complaint count.
- `DisputeRepository.findResponsibleResolvedDisputeCounts(...)`
  - Native SQL aggregation across customer/provider responsibility, including both-fault responsibility.

### Aggregate projections

- `CreditReviewAggregate`
  - `userId`, `reviewCount`, `goodReviewCount`, `averageRating`, `effectiveOrderCount`.
- `UserCountAggregate`
  - `userId`, `aggregateCount`.

### Batch metadata sources

- Users are loaded through the existing `UserRepository.findAllById(...)` batch operation.
- Provider profiles use the existing MyBatis-Plus `selectList` with one `user_id IN (...)` query.
- `CreditSnapshotService.getSnapshots(...)` combines the four grouped credit/risk queries into per-user snapshots.
- `CreditSnapshotService.getDisplayCreditScores(...)` exposes the batched display score map used by service-package metadata assembly.

No DTO contract was changed.

## 5. Semantic verification

The final A2 semantic verification passed for all required behaviors:

- Ordinary-sort differential: passed.
- Filter differential: passed.
- Recommend complete ordering: passed.
- Same `feedSeed` stability: passed.
- Current-user city factor: passed.
- Favorite factor: passed.
- Credit factor: passed.
- Date factor: passed.
- Java `Objects.hash(feedSeed, id)` ordering semantics: passed.
- Sequential diversification: passed.
- `page=1` / `page=2` cross-page semantics: passed.
- DTO compatibility: passed.
- Recommend metadata query count remains fixed for 27 photographers: passed.

Ordinary-sort differential coverage includes unfiltered queries, keyword, city, scene, style, price range, date, time tag, public visibility, page 1, page 2, filtered total, and deterministic ID secondary sorting. `INSTR` behavior was verified for null, empty string, Chinese text, case-insensitive matching, and JSON/text membership cases.

For `feedSeed=semantic-seed`, the fixed complete recommendation order used by the regression test is:

```text
[12, 1, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2]
```

## 6. CreditSnapshot equivalence

Batch snapshots were compared with the legacy single-user `getSnapshot(...)` behavior for normal data, no reviews, no complaint/dispute, complaint, dispute, missing data, and zero-value cases.

The following values are equivalent:

- score
- review count
- positive count
- average rating
- completed reviewed order count
- responsible complaint count
- responsible dispute count

## 7. Recommendation Pagination Exception

### Ordinary sorts

`DB pagination: DONE`

The `latest`, `price_asc`, `price_desc`, and `created_asc` paths use database filtering, sorting, pagination, and count.

### Recommend

```text
N+1: DONE
DB pagination: NOT DONE BY DESIGN
```

The recommend path intentionally retains its complete candidate set, Java recommendation scoring, `Objects.hash(feedSeed, id)` ordering, sequential diversification, and final Java pagination. This preserves the current recommendation order and cross-page behavior exactly. Translating the stateful diversification algorithm to ordinary SQL pagination would change semantics; a recursive-CTE equivalent is outside the approved P0 risk and complexity budget.

Remaining technical debt: the recommend path is not database paginated. This exception does not apply to the four ordinary sorts.

## 8. Tests and MySQL smoke evidence

### A2 focused suite

```text
Tests run: 43
Failures: 0
Errors: 0
Skipped: 0
BUILD SUCCESS
```

### MySQL ordinary/latest smoke

```text
Request: /service-packages?page=1&size=10
HTTP status: 200
Business code: 200
Success: true
Records: 10
Total: 54
CandidateCount: 10
PhotographerCount: 5
Hibernate SQL: 7
MyBatis SQL: 1
SQL count: 8
```

### MySQL recommend smoke

```text
Request: /service-packages?page=1&size=10&sort=recommend&feedSeed=semantic-seed
HTTP status: 200
Business code: 200
Success: true
Records: 10
Total: 54
CandidateCount: 54
PhotographerCount: 27
Hibernate SQL: 6
MyBatis SQL: 1
SQL count: 7
```

The two MySQL smoke tests passed with zero failures, errors, or skipped tests.

Known environment limitation: some additional Windows web integration tests previously failed during Spring Context initialization because `IpLocationService` could not establish the JDK loopback connection. Those runs did not reach business assertions and are not reported as business-test passes.

## 9. A3 readiness

- `camera_perf_a1` is unchanged.
- `local-service-package-perf-dataset-v1` is unchanged.
- The A1 performance probe is retained.
- A3 must reuse the identical endpoint, parameters, dataset, Cold/Warm definition, probe, database, and execution method used by A1.
- The official A3 24-run After benchmark has **not** been executed.
