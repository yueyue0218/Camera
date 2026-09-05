package com.action.camera.auth;

import com.action.camera.auth.domain.SmsChallenge;
import com.action.camera.auth.domain.UserSession;
import com.action.camera.domain.User;
import jakarta.persistence.Column;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

class PhoneAuthSchemaContractTest {

    private static final String MIGRATION = "db/migration/add_phone_auth_sessions.sql";
    private static final String EXECUTION_ORDER = "db/README_EXECUTION_ORDER.md";

    @Test
    void userPhoneMappingsMatchMigration() throws Exception {
        String sql = readResource(MIGRATION).toLowerCase();
        Table table = User.class.getAnnotation(Table.class);

        assertColumn(User.class, "phone", "phone", 20, true);
        assertColumn(User.class, "phoneVerifiedAt", "phone_verified_at", 255, true);
        assertColumn(User.class, "lastLoginAt", "last_login_at", 255, true);
        assertThat(uniqueNames(table.uniqueConstraints())).contains("uk_users_phone");
        assertThat(sql)
                .contains("alter table users add column phone varchar(20) null")
                .contains("alter table users add column phone_verified_at datetime null")
                .contains("alter table users add column last_login_at datetime null")
                .contains("alter table users add unique index uk_users_phone (phone)");
    }

    @Test
    void smsChallengeEntityAndSqlDeclareSameIndexes() throws IOException {
        Table table = SmsChallenge.class.getAnnotation(Table.class);
        String sql = readResource(MIGRATION).toLowerCase();

        assertThat(table.name()).isEqualTo("sms_challenges");
        assertThat(indexNames(table.indexes())).containsExactlyInAnyOrder(
                "idx_sms_phone_purpose_created",
                "idx_sms_ip_created",
                "idx_sms_device_created",
                "idx_sms_expires_at");
        assertThat(sql)
                .contains("create table if not exists sms_challenges")
                .contains("phone           varchar(20)  not null")
                .contains("purpose         varchar(32)  not null")
                .contains("code_hash       varchar(100) not null")
                .contains("attempt_count   int          not null default 0")
                .contains("max_attempts    int          not null default 5");
        for (String index : indexNames(table.indexes())) {
            assertThat(sql).contains(index.toLowerCase());
        }
    }

    @Test
    void userSessionEntityAndSqlDeclareSameConstraintsAndIndexes() throws Exception {
        Table table = UserSession.class.getAnnotation(Table.class);
        String sql = readResource(MIGRATION).toLowerCase();

        assertThat(table.name()).isEqualTo("user_sessions");
        assertThat(uniqueNames(table.uniqueConstraints())).containsExactlyInAnyOrder(
                "uk_user_sessions_session_id",
                "uk_user_sessions_refresh_hash");
        assertThat(indexNames(table.indexes())).containsExactlyInAnyOrder(
                "idx_user_sessions_user_active",
                "idx_user_sessions_expires_at");
        assertThat(UserSession.class.getDeclaredField("refreshTokenHash")
                .getAnnotation(Column.class).columnDefinition()).isEqualTo("CHAR(64)");
        assertThat(sql)
                .contains("create table if not exists user_sessions")
                .contains("session_id         varchar(64)  not null")
                .contains("refresh_token_hash char(64)     not null")
                .contains("unique key uk_user_sessions_session_id (session_id)")
                .contains("unique key uk_user_sessions_refresh_hash (refresh_token_hash)");
        for (String index : indexNames(table.indexes())) {
            assertThat(sql).contains(index.toLowerCase());
        }
    }

    @Test
    void migrationIsRepeatableAndOrderedForFreshAndExistingDatabases() throws IOException {
        String sql = readResource(MIGRATION).toLowerCase();
        String readme = readResource(EXECUTION_ORDER);
        String migrationEntry = "migration/add_phone_auth_sessions.sql";
        String fresh = section(readme, "## 路径 A", "## 路径 B");
        String legacy = section(readme, "## 路径 B", "## 自动部署前数据库闸门");

        assertThat(sql)
                .contains("information_schema.columns")
                .contains("information_schema.statistics")
                .contains("create table if not exists sms_challenges")
                .contains("create table if not exists user_sessions")
                .doesNotContain("drop table")
                .doesNotContain("delete from users");
        assertThat(fresh).contains(migrationEntry);
        assertThat(legacy).contains(migrationEntry);
    }

    private void assertColumn(Class<?> type,
                              String fieldName,
                              String columnName,
                              int length,
                              boolean nullable) throws Exception {
        Column column = type.getDeclaredField(fieldName).getAnnotation(Column.class);
        assertThat(column).as(type.getSimpleName() + "." + fieldName).isNotNull();
        assertThat(column.name()).isEqualTo(columnName);
        assertThat(column.length()).isEqualTo(length);
        assertThat(column.nullable()).isEqualTo(nullable);
    }

    private Set<String> indexNames(Index[] indexes) {
        return Arrays.stream(indexes).map(Index::name).collect(Collectors.toSet());
    }

    private Set<String> uniqueNames(UniqueConstraint[] constraints) {
        return Arrays.stream(constraints).map(UniqueConstraint::name).collect(Collectors.toSet());
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
