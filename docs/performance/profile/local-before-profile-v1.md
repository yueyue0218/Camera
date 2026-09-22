# A-PERF-01 Profile Before Baseline v1

## 1. Baseline identity

| Item | Value |
| --- | --- |
| Repository revision | `e410d5e1ecdad6e0969de0d7520a782bc45a36ec` (`origin/main`) |
| Revision date | 2026-09-10 15:47:24 +08:00 |
| Worktree | `C:\Users\LiXiaozhou\Camera-A-ProfileBaseline` (detached HEAD) |
| Capture date | 2026-09-19 +08:00 |
| Java / Maven | Java 17.0.12 / Maven 3.9.16 |
| Database | H2 2.3.232, MySQL compatibility mode |
| Request harness | Spring `MockMvc`, including JWT interceptor, controller, service, JPA/MyBatis, and JSON serialization |

The worktree was created outside the dirty primary checkout. The primary checkout remained on its existing `main` revision and its existing frontend modifications were not touched.

## 2. Why this run uses MockMvc

The managed execution environment blocks the Java NIO loopback pipe used by both the default JDK HTTP client and embedded Tomcat. A random-port integration test therefore fails before any application request with:

```text
java.io.IOException: Unable to establish loopback connection
Caused by: java.net.SocketException: Invalid argument: connect
```

`MockMvc` was used so the run still traverses the real authentication interceptor, controller, service, Hibernate/MyBatis queries, and response serialization. The HTTP request count and frontend dependency stages were reproduced from the current React pages. Browser transport, connection scheduling, paint, and image decode time are not included.

Consequently:

- HTTP count, SQL count, response byte count, and N+1 shape are valid Before acceptance evidence.
- Backend and modeled critical-path timings are directional local evidence only, not a production SLO.
- A final Chrome + MySQL run remains required before closing A-PERF-01.

## 3. Fixed dataset

| Fixture | Count |
| --- | ---: |
| Authenticated viewer | 1 customer (`981000`) |
| Public profile target | 1 provider (`981001`) |
| Viewer followers | 12 |
| Viewer following — customer role | 12 |
| Viewer following — provider role | 12 |
| Visible moments | 30 |
| Target-provider moments | 10 |
| Inline images per moment | 3 |
| Characters per inline image value | 1,047 |
| Avatar files | 0 |

The absence of avatar files deliberately keeps file-download behavior out of this SQL baseline. A real profile with an avatar adds one download request; follower/following avatars can add one download per distinct card after the already-observed brief fan-out.

## 4. Reproduced frontend waterfalls

### Self profile (`ProfilePage`, customer role)

1. Stage 1, five requests launched together: `/users/me`, `/moments`, credit summary, order list, followers.
2. Stage 2: one `/users/{id}/brief` request per follower (12).
3. Stage 3: customer-role and provider-role following lists (2).
4. Stage 4: one `/users/{id}/brief` request per following card (24).
5. Stage 5: `/me/service-package-interests`.
6. Stage 6: `/demands/me/history`.

Total: **45 authenticated business requests** before any optional avatar download.

### Public profile (`PublicProfilePage`)

The page launches public profile, brief, author-filtered moments, received reviews, credit summary, and the viewer's follower list together.

Total: **6 authenticated business requests** before the optional target-avatar download.

## 5. Five-sample Before results

Two warm-up page runs were discarded before the five recorded samples.

### Self profile

| Sample | HTTP | SQL | Backend sum (ms) | Modeled critical path (ms) | Sequential harness wall (ms) | Payload bytes |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 45 | 464 | 567.635 | 121.024 | 580.585 | 148,588 |
| 2 | 45 | 464 | 460.429 | 93.111 | 472.866 | 148,588 |
| 3 | 45 | 464 | 397.735 | 80.877 | 405.738 | 148,588 |
| 4 | 45 | 464 | 361.162 | 74.849 | 370.301 | 148,588 |
| 5 | 45 | 464 | 347.989 | 69.741 | 355.799 | 148,588 |
| **Average / p50** | **45** | **464** | **426.990 avg** | **87.920 avg / 80.877 p50** | **437.058 avg** | **148,588** |

Stable SQL split: **427 Hibernate + 37 MyBatis = 464**.

### Public profile

| Sample | HTTP | SQL | Backend sum (ms) | Modeled critical path (ms) | Sequential harness wall (ms) | Payload bytes |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 6 | 109 | 98.409 | 24.658 | 100.725 | 48,888 |
| 2 | 6 | 109 | 87.257 | 22.488 | 89.304 | 48,888 |
| 3 | 6 | 109 | 77.733 | 19.411 | 78.977 | 48,888 |
| 4 | 6 | 109 | 70.353 | 15.473 | 71.612 | 48,888 |
| 5 | 6 | 109 | 69.419 | 18.536 | 70.884 | 48,888 |
| **Average / p50** | **6** | **109** | **80.634 avg** | **20.113 avg / 19.411 p50** | **82.301 avg** | **48,888** |

Stable SQL split: **106 Hibernate + 3 MyBatis = 109**.

The modeled critical path is the sum of the maximum measured backend time in each frontend dependency stage. It is not a browser wall-clock measurement.

## 6. Endpoint decomposition

All SQL counts below include the four Hibernate statements currently paid by the JWT/session authentication path on every protected request.

| Endpoint | Hibernate | MyBatis | Total SQL | Backend (ms) | Payload bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/moments` (30 moments) | 125 | 0 | **125** | 29.176 | **138,062** |
| `/users/981000/followers` (12 cards) | 30 | 0 | **30** | 16.377 | 1,725 |
| `/users/981000/following?role=CUSTOMER` (12 cards) | 30 | 0 | **30** | 13.250 | 1,953 |
| `/users/981000/following?role=PROVIDER` (12 cards) | 30 | 0 | **30** | 13.960 | 1,943 |
| `/users/981001/public-profile?role=PROVIDER` | 12 | 2 | **14** | 13.803 | 658 |
| `/users/981001/brief?role=PROVIDER` | 5 | 1 | **6** | 6.535 | 114 |
| Target `/moments` (10 moments) | 45 | 0 | **45** | 13.183 | **46,055** |
| `/users/981001/credit` | 9 | 0 | **9** | 10.395 | 294 |
| `/users/981001/reviews` | 5 | 0 | **5** | 5.366 | 42 |

## 7. Confirmed Top 3 — self profile

### 1. Frontend brief fan-out after social-list responses

- 12 follower briefs + 24 following briefs = **36 extra HTTP requests**.
- Each brief costs 5 Hibernate + 1 MyBatis statement in this authenticated path.
- Aggregate: **216 SQL**, or **46.6%** of the self-profile SQL budget.
- The social-list DTO already supplies user ID, nickname, avatar file ID, role, bio, and follow state. The frontend nevertheless calls `/brief` whenever `avatarData/avatarUrl` is absent, even when `avatarFileId` is null.

### 2. Moment list lazy-collection N+1 plus inline image payload

- `/moments`: **125 SQL** for 30 rows.
- Removing the 4 authentication statements leaves **121 data statements = 1 + 30 × 4**.
- The four per-moment lazy collection paths are images, mentions, liked-user IDs, and favorited-user IDs.
- The response contributes **138,062 / 148,588 bytes = 92.9%** of the self-profile payload.
- `ProfilePage` requests the entire moment feed and filters by author in the browser.

### 3. Social-list backend N+1

- Followers + two role-specific following lists: **90 SQL** total.
- Each 12-card endpoint costs 30 SQL. Removing 4 authentication statements gives **26 = 2 + 2 × 12** data statements.
- The two per-card statements are `UserRepository.findById` and `existsByFollowerIdAndFollowingUserId`.

Together these three areas account for **431 / 464 SQL = 92.9%** and **40 / 45 HTTP requests = 88.9%** on the fixed self-profile dataset.

## 8. Confirmed Top 3 — public profile

1. Target moments: **45 SQL**, **46,055 bytes**.
2. Viewer follower list used only to compute “follows me”: **30 SQL**.
3. Public-profile aggregate: **14 SQL**, including 2 MyBatis statements.

These account for **89 / 109 SQL = 81.7%**. The target moment response accounts for **94.2%** of public-profile payload.

The page also issues both `/public-profile` and `/brief`, and separately requests credit even though the provider extension already includes a display credit score. Those duplications are confirmed, but they rank below the three items above on this dataset.

## 9. Baseline health and environment notes

The focused Profile-adjacent regression suite passed after applying the existing test-environment-compatible HTTP client property:

```text
mvn "-Dtest=SocialRelationServiceTest,MomentServiceTest,UserServiceTest,FileServiceTest" \
    "-Dspring.http.client.factory=simple" test

Tests run: 43, Failures: 0, Errors: 0, Skipped: 0
```

The first run without that property failed only because the managed environment denied the JDK HTTP client's internal loopback pipe; a one-variable rerun of `MomentServiceTest` proved the diagnosis (12 errors became 12 passes).

Maven also reports a pre-existing duplicate `jacoco-maven-plugin` declaration in `backend/pom.xml`. It did not block this baseline, but it remains a build-stability warning outside A-PERF-01's immediate optimization scope.

## 10. Acceptance gates for the next change

The first optimization should target the social/brief path while preserving response semantics. Before accepting an implementation:

1. Re-run this exact fixture and keep all business responses at code 200.
2. Reduce self-profile HTTP calls by eliminating redundant `/brief` enrichment.
3. Replace the social `2 + 2N` data-query shape with a bounded batch shape.
4. Keep list ordering, role filtering, follow-state semantics, and missing-user behavior explicitly tested.
5. Re-run the 43 focused regressions.
6. Before final closure, repeat the benchmark on MySQL with a real Chrome network waterfall and avatar files enabled.

## Recommended next implementation slice

Implement and test a self-contained social-card contract: make follower/following responses sufficient for rendering, batch-load user/follow-state data on the backend, and remove the frontend `/brief` fan-out. This slice attacks **306 of 464 SQL statements** (brief fan-out + social-list N+1) and **36 of 45 HTTP requests** without touching Moment storage or the larger image-contract migration.
