package com.action.camera.schema;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

class CurrentSchemaFreshInitContractTest {

    private static final String EXECUTION_ORDER = "db/README_EXECUTION_ORDER.md";
    private static final String STYLE_CATALOG_MIGRATION = "db/migration/add_provider_style_catalog.sql";
    private static final String AUTH_PHONE_ACCOUNT_MIGRATION = "db/migration/add_auth_phone_account.sql";
    private static final String AUTH_SESSION_MIGRATION = "db/migration/add_phone_auth_sessions.sql";
    private static final String CURRENT_SCHEMA_SYNC = "db/migration/sync_current_main_schema.sql";
    private static final Pattern CREATE_TABLE = Pattern.compile(
            "(?i)CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+`?([a-z0-9_]+)");

    @Test
    void freshInitializationCoversTablesUsedByProviderStyleMappers() throws IOException {
        Set<String> freshTables = new LinkedHashSet<>();
        for (String resource : new String[]{
                "db/V1_baseline.sql",
                "db/certification.sql",
                "db/V3_b1_b2_fresh.sql",
                "db/conversations_messages.sql",
                "db/V5_d_line_fresh.sql",
                "db/moments.sql",
                "db/migration/add_admin_governance.sql",
                STYLE_CATALOG_MIGRATION,
                AUTH_PHONE_ACCOUNT_MIGRATION,
                AUTH_SESSION_MIGRATION
        }) {
            Matcher matcher = CREATE_TABLE.matcher(readResource(resource));
            while (matcher.find()) {
                freshTables.add(matcher.group(1).toLowerCase());
            }
        }

        assertThat(freshTables)
                .contains("style_tags", "provider_style_tags", "sms_challenges", "user_sessions");
    }

    @Test
    void styleCatalogMigrationProvidesMapperKeysAndForeignKeys() throws IOException {
        String sql = readResource(STYLE_CATALOG_MIGRATION).toLowerCase();

        assertThat(sql)
                .contains("unique key uk_style_tag_name (name)")
                .contains("key idx_style_tag_category (category, enabled)")
                .contains("unique key uk_provider_style_tag (provider_profile_id, tag_id)")
                .contains("foreign key (provider_profile_id) references provider_profiles(id)")
                .contains("foreign key (tag_id) references style_tags(id)");
    }

    @Test
    void executionOrderIncludesStyleCatalogAndIntegratedAuthForBothPaths() throws IOException {
        String readme = readResource(EXECUTION_ORDER);
        String fresh = section(readme, "## 路径 A", "## 路径 B");
        String legacy = section(readme, "## 路径 B", "## 自动部署前数据库闸门");

        for (String path : new String[]{fresh, legacy}) {
            assertThat(path)
                    .contains("migration/add_provider_style_catalog.sql")
                    .contains("migration/add_auth_phone_account.sql")
                    .contains("migration/add_phone_auth_sessions.sql");
            assertThat(path.indexOf("migration/add_phone_auth_sessions.sql"))
                    .isGreaterThan(path.indexOf("migration/add_auth_phone_account.sql"));
        }
        assertThat(readme).contains("docs/data/b-auth-final-contract.md");
    }

    @Test
    void legacySchemaSyncAlignsCurrentEntityTypesWithoutRewritingBusinessData() throws IOException {
        String sql = readResource(CURRENT_SCHEMA_SYNC).toLowerCase();

        assertThat(sql)
                .contains("schema_sync_assert_max_length")
                .contains("schema_sync_assert_no_nulls")
                .contains("modify column checksum varchar(64)")
                .contains("modify column reason varchar(1000)")
                .contains("modify column created_at datetime")
                .contains("modify column student_no_hash varchar(64)")
                .contains("idx_demand_responses_current")
                .contains("idx_disputes_initiator_status")
                .contains("idx_disputes_status_created")
                .contains("idx_orders_status_created")
                .contains("idx_payment_records_status")
                .contains("idx_photo_auth_provider_status")
                .contains("idx_users_status")
                .doesNotContain("update users")
                .doesNotContain("delete from")
                .doesNotContain("drop table");
    }

    @Test
    void currentSchemaSyncRunsOnlyOnLegacyPathAndConversationMigrationRunsThereToo() throws IOException {
        String readme = readResource(EXECUTION_ORDER);
        String fresh = section(readme, "## 路径 A", "## 路径 B");
        String legacy = section(readme, "## 路径 B", "## 自动部署前数据库闸门");

        assertThat(fresh).doesNotContain("migration/sync_current_main_schema.sql");
        assertThat(legacy)
                .contains("conversations_messages.sql")
                .contains("migration/sync_current_main_schema.sql");
        assertThat(legacy.indexOf("migration/sync_current_main_schema.sql"))
                .isGreaterThan(legacy.indexOf("migration/add_dispute_previous_order_status.sql"));
    }

    private String section(String content, String start, String end) {
        int startIndex = content.indexOf(start);
        int endIndex = content.indexOf(end, startIndex + start.length());
        assertThat(startIndex).as("section start " + start).isNotNegative();
        assertThat(endIndex).as("section end " + end).isGreaterThan(startIndex);
        return content.substring(startIndex, endIndex);
    }

    private String readResource(String path) throws IOException {
        try (InputStream input = Thread.currentThread().getContextClassLoader().getResourceAsStream(path)) {
            assertThat(input).as(path).isNotNull();
            return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
