# Integration runtime DDL boundary

Base commit: `9196bf9a9a291a8e37dc977e495093a5a32f5283`.

## Root cause and startup path

Spring Boot discovers `ConversationSchemaInitializer` as a component and calls its
`ApplicationRunner.run()` after context initialization. It checks for MySQL and the
conversations table, then calls ensureConversationOrderId, ensureMessageFileId,
ensureConversationIndexes and ensureHiddenConversationTable. The last method checks
users but unconditionally sends CREATE TABLE IF NOT EXISTS. Existing tables do not
prevent the DDL statement from being sent. Exceptions are caught and logged as WARN;
process survival therefore does not demonstrate a successful schema check.

`MomentSchemaInitializer` is another ApplicationRunner: on MySQL it reads the type of
moment_images.image_data and sends ALTER unless the type is MEDIUMTEXT or LONGTEXT.
Hibernate `ddl-auto=validate` does not control either of these JDBC runners.
The only other ApplicationRunner found is DemoUserInitializer, restricted to dev/smoke;
the intended integration deployment uses staging,integration, never dev/smoke.

## Formal Path A coverage (no SQL changed)

| Runtime operation | Formal SQL in the executed 17-file manifest |
| --- | --- |
| ADD conversations.order_id BIGINT NOT NULL DEFAULT 0 | Step 4 conversations_messages.sql: fresh CREATE and c_add_column_if_missing |
| ADD messages.file_id BIGINT NULL | Step 4: messages CREATE includes file_id |
| ADD uk_conversation_source_pair (source_type,source_id,participant_a_id,participant_b_id,order_id) | Step 4: CREATE plus explicit drop/recreate migration |
| ADD idx_conversation_a_time (participant_a_id,last_message_time) | Step 4: CREATE and c_add_index_if_missing |
| ADD idx_conversation_b_time (participant_b_id,last_message_time) | Step 4: CREATE and c_add_index_if_missing |
| CREATE conversation_hidden_by_user | Step 4: same id, conversation_id, user_id, hidden_at, PK, unique key, two indexes, two FKs, InnoDB and utf8mb4_0900_ai_ci |
| ADD uk_conversation_hidden_user (conversation_id,user_id) | Step 4: CREATE and c_add_index_if_missing |
| ADD idx_conversation_hidden_user (user_id,hidden_at) | Step 4: CREATE and c_add_index_if_missing |
| ADD idx_conversation_hidden_conversation (conversation_id) | Step 4: CREATE and c_add_index_if_missing |
| MODIFY moment_images.image_data MEDIUMTEXT NOT NULL | Step 6 moments.sql creates table; step 9 migration/alter_moment_images_image_data.sql sets final type |

Neither runtime initializer contains DROP statements. The dynamic ALTER helper in
ConversationSchemaInitializer is called only for the five listed ordinary/hidden
indexes (the conversation source unique key has its own method). No structure owned
by these runners is missing from the formal fresh-init path. No new migration is needed.

## Configuration contract

Activate `integration` in addition to the previously selected SMS profile:

```text
--spring.profiles.active=staging,integration
```

`application-integration.yml` sets Hibernate validate, disables Spring SQL init,
and declares `camera.integration.runtime-ddl-enabled=false`. A shared condition
omits both runner beans whenever integration is active, including combined profiles.
Missing YAML or a missing property still defaults to disabled. Setting this property
to true in integration fails context registration, rather than enabling runtime DDL.
This is an explicit read-only guard, not a supported migration opt-in.

Outside integration the condition returns true without consulting the integration
setting: all existing initializer method bodies and error handling are unchanged.
No change is made to application.yml, prod/staging SMS selection, service units,
credentials, SQL files, database grants, or any running environment.

The deployment must keep ddl-auto=validate and SQL init=never; do not supply command
line/environment overrides that select create/update/create-drop. Profile settings
do not override higher-priority command line properties. The new guard controls the
two application JDBC runners, not a deliberately overridden Hibernate schema mode.

## Focused validation

RuntimeSchemaInitializerProfileTest checks no bean/no JDBC interaction for integration
and combined profiles, refusal of the true override, and unchanged bean registration
for default/staging/prod/dev/smoke/temp-staging.
LegacySchemaInitializerBehaviorTest checks the original nine conversation DDL calls,
the narrow image upgrade and the already-migrated image no-op using mocked MySQL.

IntegrationReadOnlyStartupTest creates an isolated in-memory H2 fixture **before**
starting the application. It starts the real CameraApplication with integration,
intercepts JDBC Statement/PreparedStatement/CallableStatement execution and records
and rejects CREATE/ALTER/DROP/TRUNCATE/RENAME/COMMENT/GRANT/REVOKE attempts. Successful
startup must validate all 37 entities, retain validate/never and emit no runtime DDL,
including shutdown. A second fixture deliberately lacks privacy_consent_events;
startup must fail with Hibernate's missing-table validation error and must not repair it.
Fixture generation/removal is test-only, not a server migration or application startup.
H2 maps the MySQL MEDIUMTEXT alias to VARCHAR; the disposable fixture converts only
moment_images.image_data to H2 CLOB before startup to match @Lob's JDBC metadata.
Production entity mappings and the formal MySQL SQL are not changed for this test.

This proves the local startup boundary and actual Hibernate validation execution;
it does not replace an actual MySQL 8.0.46 JPA validation of portra_integration. That
remains a later, separately approved deployment step. Do not start 8081 from this task.

The previous prepared service used only staging and an unconditional blocked start
gate. It is not automatically updated by this source change. A later deployment
approval must regenerate its release/JAR hashes, enable staging,integration and
replace the old blocked gate with the reviewed new-commit checks. Never drop a new
JAR into the old commit's release directory or claim the old package is deployable.
