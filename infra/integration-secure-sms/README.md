# 8081 default-scheme custom-code candidate

REVIEW ONLY. This package has NOT been deployed. No server SQL, starts, grants or IAM changes
are authorized by packaging. The existing 8080 service, portra_staging, Nginx and original
uploads are outside its mutation scope. The base package remains unchanged.

## Security contract

Both LOGIN and REAUTH use PNVS 默认方案. Portra generates six digits with SecureRandom,
sends the actual code, hashes it with SMS_CODE_PEPPER and BCrypt, and verifies the precise
challenge locally. CheckSmsVerifyCode is never used. Only hashes are persisted. REAUTH
binds user ID, current session ID and ACCOUNT_CLOSURE. Other sensitive operations remain
unsupported until explicitly implemented. Privacy consent and closure checks are unchanged.

POST /auth/sms/send and /privacy/account-closure/code now return
`data: {challengeId, expiresAt}`. Both login verification routes and account closure require
challengeId in addition to their existing fields. Older clients without challengeId fail
closed. Updated Web and Harmony login source is included in the commit; their distribution
is a separate reviewed step. There is no closure client implementation in this baseline;
any external closure client must use the new response/request contract.

The hash includes random challenge ID, phone hash, purpose, owner, session and operation.
Database locks serialize sends (phone/IP/device) and consumption (phone/challenge). Resending
invalidates outstanding challenges for that phone and purpose, including other sessions.
An admitted replacement that fails to send still invalidates its predecessor. Rate-limited
attempts leave existing challenges untouched. Failed/expired/consumed/legacy rows are rejected.
Wrong-attempt counters and consumption use REQUIRES_NEW: a later business rollback cannot
revive the code. A lost response or failed business action after consumption requires a new
code; there is no authorization token or retry bypass. Lock rows must not be cleaned while
processes are using them; they contain only hashed scope keys, not phone numbers or codes.

## Migration and compatibility

V20261103__sms_challenge_binding.sql adds five nullable columns and a unique challenge ID
index to sms_challenges, plus the sms_challenge_locks table. The migration explicitly targets
portra_integration. It is NOT automatic and must not be run against portra_staging. No existing
17 SQL files need rerunning. Existing rows have NULL challenge_id and are rejected. Hibernate
remains validate; missing migration prevents startup. Expected entity count is now 38.
Application DML-only grants remain unchanged. No new DDL permission is needed by the app.

Schema is additive for old binaries, but old/new binaries MUST NOT be mixed: the old code
neither honors invalidation nor verifies custom PNVS codes locally. Rollback must stop this
candidate, invalidate pending challenges under a separately approved procedure, and restore
a compatible application/client pair; do not silently fall back to the old JAR.

## Configuration and package changes

RAM role PortraSmsEcsRole and PortraSmsVerifyOnly v1 were reviewed by the owner. Do not
recreate them. LOGIN signature 恒创联众 / template 100001 remains unchanged.
SMS_REAUTH_SCHEME_NAME may be omitted or set to 默认方案. SMS_REAUTH_TEMPLATE_ID remains
required and may equal the LOGIN ID if its approved text suits the operation. Other gates
(independent secrets, SMTP STARTTLS, privacy version 2026-10-29-v1, forbidden overrides,
read-only JPA validation, loopback binding, runtime-DDL disabled, resource limits) remain.
Never set operator attestations without review. Never overwrite the existing app.env with
the example. Reuse existing independent keys; never copy secrets from 8080.

The generated bundle updates JAR, extracted runtime, JPA helper (38 entities), pinned commit
paths/start token and SHA256SUMS. The helper is compiled, not executed locally. The build
script runs no tests, cloud calls, SQL or services. deploy-once.sh still STARTS 8081 after its
gates pass and must NOT be executed until separately approved. The migration is never invoked
by deploy-once.sh. The existing role/endpoint probes are retained in that future deployment
workflow; no such probes were repeated during this change.
