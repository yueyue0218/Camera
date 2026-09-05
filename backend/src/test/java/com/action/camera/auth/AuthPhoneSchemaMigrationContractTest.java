package com.action.camera.auth;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class AuthPhoneSchemaMigrationContractTest {

    private static final String MIGRATION = "db/migration/add_auth_phone_account.sql";
    private static final String EXECUTION_ORDER = "db/README_EXECUTION_ORDER.md";

    @Test
    void migrationAddsOnlyNullablePhoneAccountColumns() throws IOException {
        String sql = readResource(MIGRATION).toLowerCase();

        assertThat(sql)
                .contains("mobile_cipher")
                .contains("varbinary(512) null")
                .contains("mobile_hash")
                .contains("char(64) null")
                .contains("mobile_masked")
                .contains("varchar(32) null")
                .contains("phone_verified_at")
                .contains("datetime(6) null")
                .doesNotContain("add column phone ")
                .doesNotContain("mobile_hash char(64) not null")
                .doesNotContain("phone_verified_at datetime(6) not null");
    }

    @Test
    void migrationIsIdempotentAndStopsBeforeAddingAConflictingUniqueIndex() throws IOException {
        String sql = readResource(MIGRATION).toLowerCase();

        assertThat(sql)
                .contains("information_schema.columns")
                .contains("information_schema.statistics")
                .contains("group by mobile_hash")
                .contains("having count(*) > 1")
                .contains("duplicate mobile hash detected")
                .contains("signal sqlstate '45000'")
                .contains("uk_users_mobile_hash")
                .contains("unique (`mobile_hash`)");
    }

    @Test
    void migrationDoesNotBackfillOrRewriteUserIdentity() throws IOException {
        String sql = readResource(MIGRATION).toLowerCase();

        assertThat(sql)
                .doesNotContain("update users")
                .doesNotContain("delete from users")
                .doesNotContain("drop table users")
                .doesNotContain("modify column id")
                .doesNotContain("change column id");
    }

    @Test
    void readmeOrdersMigrationForFreshAndLegacyPathsAndKeepsProductionGate() throws IOException {
        String readme = readResource(EXECUTION_ORDER);
        String migrationEntry = "migration/add_auth_phone_account.sql";
        String fresh = section(readme, "## 路径 A", "## 路径 B");
        String legacy = section(readme, "## 路径 B", "## 自动部署前数据库闸门");

        assertThat(fresh).contains(migrationEntry);
        assertThat(legacy).contains(migrationEntry);
        assertThat(readme)
                .contains("B 线确认")
                .contains("一手机号一账号")
                .contains("DUPLICATE MOBILE HASH DETECTED");
    }

    @Test
    void migrationEndsWithScopedLegacyStateVerification() throws IOException {
        String sql = readResource(MIGRATION).toLowerCase();

        assertThat(sql)
                .contains("and column_name in ('mobile_cipher', 'mobile_hash', 'mobile_masked', 'phone_verified_at')")
                .contains("index_name = 'uk_users_mobile_hash'")
                .contains("legacy_unbound_count")
                .contains("partial_or_inconsistent_count");
        assertThat(sql.stripTrailing())
                .endsWith("from users;");
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
