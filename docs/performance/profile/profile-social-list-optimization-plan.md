# Profile Social List Optimization Plan

## Contract

- Keep `SocialUserBriefResponse` unchanged: `userId`, `nickname`, `avatarFileId`,
  `currentRole`, `bio`, and `followedByCurrentUser` already cover the Profile card.
- Preserve relation order, role filtering, duplicate behavior, null values, and the
  existing fail-fast `用户不存在` behavior for orphan relations.
- Treat avatar file downloads separately from API/JSON requests.

## Test-driven implementation

1. Add service tests that cap a 12-user list at four data statements, which leaves
   room for the four authentication statements observed by the HTTP baseline.
2. Add contract coverage for order, role filtering, mixed follow state, empty and
   one-user lists, null avatars, and orphan relations.
3. Add a frontend social-list loader test proving that 36 cards make zero calls to
   `userApi.brief` while retaining optional avatar downloads.
4. Batch-load users and viewer follow state, then assemble responses in relation
   order.
5. Replace ProfilePage's per-card brief enrichment with the tested loader.
6. Run focused RED/GREEN tests, the related backend/frontend suites, build/lint,
   and the fixed Profile baseline. Report API requests, image requests, and SQL
   separately.
