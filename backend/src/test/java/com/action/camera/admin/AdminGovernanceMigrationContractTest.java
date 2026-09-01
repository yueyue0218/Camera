package com.action.camera.admin;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class AdminGovernanceMigrationContractTest {

    private static final String MIGRATION = "db/migration/add_admin_governance.sql";
    private static final String EXECUTION_ORDER = "db/README_EXECUTION_ORDER.md";

    @Test
    void migrationAddsModerationColumnsAndIndexesForEveryContentTable() throws IOException {
        String sql = readResource(MIGRATION).toLowerCase();

        for (String table : new String[]{"demands", "service_packages", "moment_posts"}) {
            assertThat(sql).contains("'" + table + "'");
        }
        assertThat(sql)
                .contains("moderation_status")
                .contains("moderated_by")
                .contains("moderated_at")
                .contains("moderation_reason")
                .contains("idx_demands_moderation_public")
                .contains("idx_service_packages_moderation_public")
                .contains("idx_moment_posts_moderation_public");
        assertThat(occurrences(sql, "'moderation_status'")).isEqualTo(3);
        assertThat(occurrences(sql, "'moderated_by'")).isEqualTo(3);
        assertThat(occurrences(sql, "'moderated_at'")).isEqualTo(3);
        assertThat(occurrences(sql, "'moderation_reason'")).isEqualTo(3);
    }

    @Test
    void migrationCreatesReportsWithActiveDedupeConstraint() throws IOException {
        String sql = readResource(MIGRATION).toLowerCase();

        assertThat(sql)
                .contains("create table if not exists reports")
                .contains("reporter_id")
                .contains("target_type")
                .contains("target_id")
                .contains("description")
                .contains("admin_id")
                .contains("resolution")
                .contains("admin_comment")
                .contains("active_dedupe_key")
                .contains("resolved_at")
                .contains("unique key uk_reports_active_dedupe")
                .contains("idx_reports_status_created")
                .contains("idx_reports_target_status")
                .contains("idx_reports_reporter_created");
    }

    @Test
    void migrationIsGuardedAndDoesNotRewriteBusinessStatuses() throws IOException {
        String sql = readResource(MIGRATION).toLowerCase();

        assertThat(sql)
                .contains("information_schema.columns")
                .contains("information_schema.statistics")
                .doesNotContain("update demands set status")
                .doesNotContain("update service_packages set status")
                .doesNotContain("update moment_posts set status");
    }

    @Test
    void readmeOrdersGovernanceMigrationForFreshAndLegacyDatabases() throws IOException {
        String readme = readResource(EXECUTION_ORDER);
        String migrationEntry = "migration/add_admin_governance.sql";
        String fresh = section(readme, "## 路径 A", "## 路径 B");
        String legacy = section(readme, "## 路径 B", "## 自动部署前数据库闸门");

        assertThat(fresh).contains(migrationEntry);
        assertThat(fresh.indexOf(migrationEntry)).isGreaterThan(fresh.indexOf("moments.sql"));
        assertThat(legacy).contains(migrationEntry);
        assertThat(legacy.indexOf(migrationEntry))
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

    private int occurrences(String content, String needle) {
        int count = 0;
        int offset = 0;
        while ((offset = content.indexOf(needle, offset)) >= 0) {
            count++;
            offset += needle.length();
        }
        return count;
    }
}
