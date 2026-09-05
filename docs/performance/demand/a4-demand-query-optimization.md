# A4 Demand Query Optimization

## Scope and base

- Base: `origin/main@598fb40fcbf1f9ab85d2115639ffe7cfcaf9b290`
- Endpoint: `GET /demands`
- Scope: public Demand listing query performance only
- Auth, frontend, deployment, HarmonyOS, CI/CD, Order, Conversation, Message, Notification, and write-flow business behavior were not changed.

## Baseline

- Request: `GET /demands?page=1&size=23`
- Dataset: 23 public Demands and 23 distinct publishers
- Visibility: all 23 rows were `OPEN`, `VISIBLE`, and not hidden by the customer
- SQL before: 24
- Demand query before: 1
- User SQL before: 23
- Other SQL before: 0
- Backend before: 205.970 ms

The baseline time is a value from the local service-level harness. The After timing was collected through MockMvc, so no time percentage comparison is made. The stable comparison evidence for A4 is query count and query shape.

Ignored local evidence:

`C:\Users\LiXiaozhou\Camera-A-Demand\backend\target\performance\local-before-demand-v1.txt`

## Root cause

The original ordinary listing path performed:

```text
findByStatus(OPEN)
-> load all candidates
-> Java filtering
-> Java sorting
-> DTO mapping
-> Java subList pagination
```

Each DTO called `customerInfo(customerId)`, which called `UserRepository.findById`. The keyword filter could perform the same publisher lookup before DTO mapping. With 23 distinct publishers this produced 23 User queries in addition to the main Demand query.

The mapper itself does not access the database. No additional Profile, Response, Order, or other list-mapping N+1 was observed.

## Ordinary listing implementation

The ordinary `latest` path now performs:

```text
DB WHERE
-> DB ORDER BY updated_at DESC, id DESC
-> LIMIT/OFFSET
-> countQuery
-> current-page publisherIds
-> UserRepository.findAllById
-> Map<Long, CustomerInfo>
-> DTO
```

The database query preserves:

- public `OPEN` status
- `moderationStatus = VISIBLE`
- `hiddenByCustomer = false`
- case-insensitive exact city and scene filtering
- exact styleTag and timeTag membership
- exact expectedDate filtering
- budget-overlap and null-bound behavior
- case-insensitive keyword matching across scene, description, location, style tags, and publisher nickname
- `updatedAt DESC, id DESC` ordering
- database-filtered total
- page and size behavior

Missing User records do not remove the Demand. Publisher nickname and avatar fields remain nullable, matching existing DTO behavior.

## Ordinary path SQL result

- SQL after: 3
- Demand page/count: 2
- User batch: 1
- Other SQL: 0
- SQL reduction: 87.5%
- User SQL reduction: 95.652%
- User N+1: eliminated

HTTP smoke result:

```text
GET /demands?page=1&size=23
HTTP 200
BusinessCode 200
Success true
Records 23
Total 23
SQL 3
```

## Recommendation semantic-preservation exception

The `recommend` path retains:

- the complete filtered candidate set
- current provider package preference inputs
- current city, style, and budget factors
- response-state inputs
- current-date scoring behavior
- `Objects.hash(feedSeed, id)` behavior
- Java ranking
- sequential diversification
- Java pagination and cross-page ordering

Publisher metadata is loaded with one `findAllById` batch instead of per-Demand lookups. On the anonymous 23-candidate smoke dataset the path used two fixed statements: one Demand candidate query and one User batch query.

```text
GET /demands?page=1&size=10&sort=recommend&feedSeed=demand-seed
HTTP 200
BusinessCode 200
Success true
Records 10
Total 23
Candidates 23
SQL 2
```

Full-candidate Java pagination is retained as a semantic-preservation exception. The SQL count no longer grows linearly with publisher count.

## Semantic verification

Automated coverage verifies:

- public visibility
- moderationStatus visibility
- hiddenByCustomer behavior
- publisher self visibility for detail/history
- public status behavior
- city
- scene
- styleTag
- timeTag
- expectedDate
- budget overlap and null bounds
- keyword, including publisher nickname
- null, empty, Chinese, and case behavior
- page 1 and page 2
- database-filtered total
- `updatedAt DESC, id DESC`
- missing/nullable User metadata
- DTO compatibility
- recommend full ordering and cross-page semantics
- fixed-count User batch loading

Publishing, editing, closing, responding, accepting, rejecting, moderation, order, conversation, message, and notification behaviors were not changed by the production implementation.

## Tests

Before removing the local Windows HTTP-client workaround, the focused and regression command completed:

```text
Tests run: 114
Failures: 0
Errors: 0
Skipped: 0
```

The workaround only selected `spring.http.client.factory=simple` in three existing tests. It changed no assertions or business paths and was removed from the A4 commit candidate because it is not part of the Demand optimization.

`DemandIntegrationTest` was also executed separately and produced 17 Spring Context startup errors in the current Windows/Codex environment. Embedded Tomcat failed before business assertions with `Unable to establish loopback connection` / `Invalid argument: connect`. These errors are not reported as business-test passes.

After restoring all three existing test files to `HEAD`, the required final command was rerun unchanged:

```text
mvn "-Dtest=DemandServiceTest,DemandConversationHandoffTest,DemandA4BehaviorTest,DemandRepositoryPaginationTest,DemandA4SqlSmokeTest,AdminHallModerationServiceTest,AdminHallModerationIntegrationTest" test
```

Actual post-restoration result:

```text
Tests run: 114
Failures: 0
Errors: 94
Skipped: 0
```

The 94 errors are the complete 87 cases in `DemandServiceTest` and 7 cases in `DemandConversationHandoffTest`. Both existing Spring contexts fail while constructing `IpLocationService` because the current Windows/JDK sandbox cannot establish its loopback connection. No test in either class reached a business assertion. The remaining 20 tests passed: the nine A4 tests and eleven admin moderation regressions.

## MySQL evidence

- Server: MySQL 8.0.41
- Database: `camera_perf_a1`
- Native listing SQL: `EXPLAIN` succeeded
- Selected Demand index: `idx_demands_hall`
- Publisher nickname correlated subquery: User primary-key lookup
- Current Demand row count: 0
- Existing ServicePackage row count: 54
- Existing User row count: 28

The check was read-only. Because `camera_perf_a1` currently contains no Demand rows, this is syntax and execution-plan evidence only. It is not claimed as a real-data MySQL Demand benchmark.

Ignored local After evidence:

`C:\Users\LiXiaozhou\Camera-A-Demand\backend\target\performance\local-after-demand-v1.txt`

## Remaining risks

- Recommend remains complete-candidate Java pagination by semantic-preservation design.
- Publisher nickname keyword search uses a correlated `EXISTS`; this is not N+1, but its execution plan should be monitored as the dataset grows.
- A real-data MySQL Demand smoke remains optional strengthening evidence.
- The Windows `RANDOM_PORT` integration suite requires CI/Linux verification because the current sandbox cannot establish the JDK loopback connection.

## First-stage status

`Demand Optimization = DONE`

Real-data MySQL benchmarking is not required for first-stage completion and remains optional strengthening evidence.
