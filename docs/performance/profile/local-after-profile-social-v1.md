# Profile Social List Optimization — Local After v1

## Contract decision

No API contract expansion was required. The existing `SocialUserBriefResponse`
already contains every Profile social-card field:

- `userId`
- `nickname`
- `avatarFileId`
- `currentRole`
- `bio`
- `followedByCurrentUser`

The implementation keeps that DTO unchanged. The frontend normalizes
`currentRole` to its local `role` display field and resolves only the optional
avatar object URL.

## Fixed no-avatar Profile baseline

The fixed fixture remains 12 followers, 12 customer-role following users, 12
provider-role following users, and no avatar files.

| Request class | Before | After | Change |
| --- | ---: | ---: | ---: |
| API / JSON requests | 45 | **9** | -36 |
| Image requests | 0 | **0** | unchanged |
| Total requests | 45 | **9** | -36 |
| `/brief` fan-out | 36 | **0** | -36 |

With avatars present, API / JSON requests remain 9 while image requests may grow
with the number of cards that declare an `avatarFileId`. Avatar downloads are not
counted as `/brief` calls.

The nine API requests are the five initial Profile requests, two role-specific
following requests, the service-package interests request, and the demand-history
request.

## SQL evidence

The test first observed the old service shape for a 12-user following list:

```text
12-user following data SQL: 26
```

After batching users and viewer follow state, the real MockMvc endpoints including
JWT/session authentication report:

```text
PROFILE_SOCIAL_AFTER cards=12 followersSql=8 followingCustomerSql=8 followingProviderSql=8
```

| Endpoint, 12 cards | Before SQL | After SQL | Change |
| --- | ---: | ---: | ---: |
| Followers | 30 | **8** | -22 |
| Following — CUSTOMER | 30 | **8** | -22 |
| Following — PROVIDER | 30 | **8** | -22 |

Each After result consists of four authentication statements and four bounded
business statements: target validation, ordered relations, batched users, and
batched viewer follow state.

For the unchanged fixed Profile dataset, the full-page SQL total reconstructs as:

```text
464 Before
- 216 removed brief SQL
-  90 old social-list SQL
+  24 batched social-list SQL
= 182 After
```

This is an endpoint-measured reconstruction rather than a new browser wall-clock
sample. The changed endpoints were measured through MockMvc with authentication;
all other Profile endpoints are unchanged by this slice.

## Preserved behavior

Automated tests cover:

- relation order restored after unordered batch reads;
- role filtering;
- mixed followed/unfollowed state;
- DTO card fields and null avatar values;
- empty and one-user lists;
- orphan relations are logged and skipped while valid cards retain relation order;
- 36 frontend cards with zero `userApi.brief` calls;
- successful and failed optional avatar downloads.

The endpoints have no pagination contract today; this change neither adds nor
alters pagination.

## Verification

```text
Full backend suite:
Tests run: 714, Failures: 0, Errors: 0, Skipped: 2

JaCoCo:
All coverage checks met

Frontend suite:
Tests: 66, Pass: 66, Fail: 0

Frontend lint:
0 errors, 38 existing warnings

Frontend production build:
success, 1213 modules transformed
```

The full backend verification uses an explicit JDK Unix-domain socket temporary
directory so the Windows loopback integration tests run instead of failing during
environment startup.

Maven continues to emit the pre-existing duplicate `jacoco-maven-plugin` warning.
Vite continues to emit pre-existing chunk-size and mixed static/dynamic import
warnings. Neither warning was introduced by this slice.
