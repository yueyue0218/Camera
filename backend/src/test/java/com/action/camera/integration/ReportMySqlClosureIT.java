package com.action.camera.integration;

import com.action.camera.common.UserContext;
import com.action.camera.domain.User;
import com.action.camera.report.domain.Report;
import com.action.camera.report.domain.ReportTargetType;
import com.action.camera.report.repository.ReportRepository;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import javax.sql.DataSource;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mockingDetails;

/**
 * Explicit MySQL acceptance suite: mvn test -Dtest=ReportMySqlClosureIT
 * -Dportra.mysql.clientConfig=<local client.ini>. Never falls back to H2.
 * This IT is explicitly invoked, without changing the shared Maven test configuration.
 */
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
class ReportMySqlClosureIT extends ReportClosureIntegrationTest {
    private static final String SCHEMA = "portragovp0test";
    private static final String DATA_DIRECTORY =
            "c:/users/lixiaozhou/.codex/test-environments/portra-mysql-3307/data";

    @Autowired JdbcTemplate jdbc;
    @Autowired DataSource dataSource;
    @MockitoSpyBean ReportRepository racingReports;
    @PersistenceContext EntityManager entityManager;

    @DynamicPropertySource
    static void useIsolatedMySql(DynamicPropertyRegistry registry) throws Exception {
        String config = System.getProperty("portra.mysql.clientConfig");
        if (config == null || config.isBlank()) {
            throw new IllegalStateException("Explicit isolated MySQL client configuration is required");
        }
        Map<String, String> client = new HashMap<>();
        boolean inClient = false;
        for (String line : Files.readAllLines(Path.of(config))) {
            String value = line.trim();
            if (value.startsWith("[")) { inClient = value.equals("[client]"); continue; }
            if (inClient && !value.isEmpty() && !value.startsWith("#") && !value.startsWith(";")) {
                int separator = value.indexOf('=');
                if (separator > 0) client.put(value.substring(0, separator).trim(), value.substring(separator + 1).trim());
            }
        }
        if (!"127.0.0.1".equals(client.get("host")) || !"3307".equals(client.get("port"))
                || !SCHEMA.equals(client.get("database")) || !"portra_gov_test".equals(client.get("user"))
                || client.getOrDefault("password", "").isBlank()) {
            throw new IllegalStateException("Refusing a connection outside the approved isolated MySQL instance");
        }
        String url = "jdbc:mysql://127.0.0.1:3307/" + SCHEMA
                + "?sslMode=DISABLED&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai&characterEncoding=UTF-8";
        // Validate with SELECT only, before Spring creates a datasource or runs any initializer.
        try (Connection connection = DriverManager.getConnection(url, client.get("user"), client.get("password"))) {
            validateStartupIdentity(connection);
        }
        registry.add("spring.datasource.url", () -> url);
        registry.add("spring.datasource.driver-class-name", () -> "com.mysql.cj.jdbc.Driver");
        registry.add("spring.datasource.username", () -> client.get("user"));
        registry.add("spring.datasource.password", () -> client.get("password"));
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "none");
        registry.add("spring.jpa.properties.hibernate.dialect", () -> "org.hibernate.dialect.MySQLDialect");
        registry.add("spring.sql.init.mode", () -> "never");
        registry.add("camera.demo.seed-users", () -> "false");
        registry.add("spring.jpa.show-sql", () -> "false");
        registry.add("logging.level.org.hibernate.SQL", () -> "WARN");
        registry.add("logging.level.org.hibernate.orm.jdbc.bind", () -> "OFF");
    }

    private static void validateStartupIdentity(Connection connection) throws Exception {
        if (!"MySQL".equals(connection.getMetaData().getDatabaseProductName())
                || !SCHEMA.equals(connection.getCatalog())
                || !connection.getMetaData().getURL().startsWith("jdbc:mysql://127.0.0.1:3307/" + SCHEMA)) {
            throw new IllegalStateException("Refusing an unverified database before Spring startup");
        }
        try (var statement = connection.createStatement();
             var identity = statement.executeQuery("SELECT @@port, @@datadir")) {
            if (!identity.next() || identity.getInt(1) != 3307) {
                throw new IllegalStateException("Unexpected isolated database port");
            }
            String directory = identity.getString(2).replace('\\', '/').replaceAll("/+$", "")
                    .toLowerCase(java.util.Locale.ROOT);
            if (!DATA_DIRECTORY.equals(directory)) {
                throw new IllegalStateException("Refusing another data directory before Spring startup");
            }
        }
    }

    @Override
    @BeforeEach
    void setup() {
        assertIsolatedDatabase();
        // Clear only this suite's fixtures in the approved standalone schema.
        // Keep foreign-key checks enabled; never drop or recreate the migrated schema.
        for (String table : List.of("reports", "audit_records", "demand_responses",
                "service_package_interests", "user_sessions", "user_role_bindings",
                "demands", "service_packages", "users")) {
            jdbc.update("DELETE FROM " + table);
        }
        super.setup();
    }

    private void assertIsolatedDatabase() {
        try (var connection = dataSource.getConnection()) {
            assertThat(connection.getMetaData().getDatabaseProductName()).isEqualTo("MySQL");
            assertThat(connection.getCatalog()).isEqualTo(SCHEMA);
            assertThat(connection.getMetaData().getURL()).startsWith("jdbc:mysql://127.0.0.1:3307/" + SCHEMA);
        } catch (java.sql.SQLException exception) {
            throw new IllegalStateException("Unable to verify isolated MySQL identity", exception);
        }
        assertThat(jdbc.queryForObject("SELECT @@port", Integer.class)).isEqualTo(3307);
        String directory = jdbc.queryForObject("SELECT @@datadir", String.class);
        assertThat(directory.replace('\\', '/').replaceAll("/+$", "").toLowerCase(java.util.Locale.ROOT))
                .isEqualTo(DATA_DIRECTORY);
        assertThat(jdbc.queryForObject("SELECT @@foreign_key_checks", Integer.class)).isEqualTo(1);
    }

    @Test
    void actualMigrationHasInnoDbNullableUniqueDedupeAndExpectedIsolation() {
        assertThat(jdbc.queryForObject("SELECT @@transaction_isolation", String.class)).isEqualTo("REPEATABLE-READ");
        for (String table : List.of("reports", "audit_records", "demands", "service_packages", "users")) {
            assertThat(jdbc.queryForObject("SELECT ENGINE FROM information_schema.tables"
                    + " WHERE table_schema=DATABASE() AND table_name=?", String.class, table)).isEqualTo("InnoDB");
        }
        assertThat(jdbc.queryForObject("SELECT NON_UNIQUE FROM information_schema.statistics"
                + " WHERE table_schema=DATABASE() AND table_name='reports'"
                + " AND index_name='uk_reports_active_dedupe' AND column_name='active_dedupe_key'", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT IS_NULLABLE FROM information_schema.columns"
                + " WHERE table_schema=DATABASE() AND table_name='reports' AND column_name='active_dedupe_key'", String.class))
                .isEqualTo("YES");
        assertThat(jdbc.queryForObject("SELECT CHARACTER_MAXIMUM_LENGTH FROM information_schema.columns"
                + " WHERE table_schema=DATABASE() AND table_name='reports' AND column_name='active_dedupe_key'", Integer.class))
                .isEqualTo(160);
    }

    @Test
    void databaseRejectsDuplicateEvenWithoutServicePrecheck() throws Exception {
        long original = create("USER", owner.getId());
        assertThatThrownBy(() -> reports.saveAndFlush(Report.create(reporter.getId(), ReportTargetType.USER,
                owner.getId(), "direct duplicate", null, LocalDateTime.now())))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThat(reports.count()).isEqualTo(1);
        resolve(original, "IGNORE", adminToken, 200);
        assertThat(reports.findById(original).orElseThrow().getActiveDedupeKey()).isNull();
        long second = create("USER", owner.getId());
        resolve(second, "IGNORE", adminToken, 200);
        assertThat(reports.findAll()).hasSize(2).allSatisfy(report -> assertThat(report.getActiveDedupeKey()).isNull());
        assertThat(create("USER", owner.getId())).isNotEqualTo(original).isNotEqualTo(second);
    }

    @ParameterizedTest
    @ValueSource(strings = {"DEMAND", "SERVICE_PACKAGE", "USER"})
    void concurrentReportsPersistExactlyOnePendingAfterBothEmptyPrechecks(String type) throws Exception {
        long id = type.equals("USER") ? owner.getId() : target(type);
        String dedupeKey = reporter.getId() + ":" + type + ":" + id;
        var bothChecked = new CyclicBarrier(2);
        var emptyChecks = new AtomicInteger();
        // Spring spies a repository interface using delegatesTo(originalProxy).
        // Retain that real proxy/transaction delegate instead of calling an abstract method.
        var repositoryDelegate = mockingDetails(racingReports).getMockCreationSettings().getDefaultAnswer();
        doAnswer(invocation -> {
            var result = (java.util.Optional<?>) repositoryDelegate.answer(invocation);
            assertThat(result).as("both real transactions must see no pending record before insertion").isEmpty();
            emptyChecks.incrementAndGet();
            bothChecked.await(10, TimeUnit.SECONDS);
            return result;
        }).when(racingReports).findByActiveDedupeKey(eq(dedupeKey));
        var codes = concurrent(
                () -> createExpect(type, id, reporterToken, "race", null, null).path("code").asInt(),
                () -> createExpect(type, id, reporterToken, "race", null, null).path("code").asInt());
        assertThat(emptyChecks.get()).isEqualTo(2);
        assertThat(codes).containsExactlyInAnyOrder(200, 40902);
        assertThat(reports.findAll()).hasSize(1).allSatisfy(report -> {
            assertThat(report.getStatus().name()).isEqualTo("PENDING");
            assertThat(report.getActiveDedupeKey()).isEqualTo(dedupeKey);
        });
        System.out.printf("MYSQL_CREATE_RACE type=%s realEmptyPrechecks=2 pending=1 codes=200,40902%n", type);
    }

    @ParameterizedTest
    @ValueSource(strings = {"DEMAND", "SERVICE_PACKAGE", "USER"})
    void twoDifferentAdministratorsCauseOnePunishmentAndOneConflict(String type) throws Exception {
        long id = type.equals("USER") ? owner.getId() : target(type);
        long reportId = create(type, id);
        User secondAdmin = new User();
        secondAdmin.setNickname("second admin");
        secondAdmin.setCurrentRole("ADMIN");
        secondAdmin.setStatus("ACTIVE");
        secondAdmin = users.saveAndFlush(secondAdmin);
        long secondAdminId = secondAdmin.getId();
        String secondToken = tokens.generateToken(secondAdminId);
        String resolution = type.equals("USER") ? "RESTRICT_USER" : "TAKE_DOWN";
        var observedDatabaseWait = new AtomicBoolean();
        // Hold the winner's real transaction after its target audit INSERT.
        // Release it only once InnoDB reports that the competitor is actually waiting.
        doAnswer(invocation -> {
            invocation.callRealMethod();
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
            while (System.nanoTime() < deadline) {
                Integer waits = jdbc.queryForObject("SHOW GLOBAL STATUS LIKE 'Innodb_row_lock_current_waits'",
                        (result, row) -> result.getInt(2));
                if (waits != null && waits > 0) {
                    observedDatabaseWait.set(true);
                    return null;
                }
                Thread.sleep(20);
            }
            throw new IllegalStateException("No real InnoDB row lock contention observed");
        }).when(auditService).record(eq(type), eq(id), anyLong(), anyString(), anyString());
        var codes = concurrent(
                () -> resolve(reportId, resolution, adminToken, null).path("code").asInt(),
                () -> resolve(reportId, resolution, secondToken, null).path("code").asInt());
        assertThat(observedDatabaseWait).isTrue();
        System.out.printf("MYSQL_ADMIN_RACE type=%s innodbWaitObserved=true codes=200,40901%n", type);
        assertThat(codes).containsExactlyInAnyOrder(200, 40901);
        var report = reports.findById(reportId).orElseThrow();
        assertThat(report.getAdminId()).isIn(admin.getId(), secondAdminId);
        assertThat(report.getStatus().name()).isEqualTo("RESOLVED");
        assertThat(report.getActiveDedupeKey()).isNull();
        assertThat(audits.findAll()).hasSize(2).allSatisfy(audit -> assertThat(audit.getAdminId()).isEqualTo(report.getAdminId()));
        assertThat(audits.findAll().stream().filter(audit -> audit.getAuditType().equals(type)).count()).isEqualTo(1);
        assertThat(audits.findAll().stream().filter(audit -> audit.getAuditType().equals("REPORT")).count()).isEqualTo(1);
        assertTargetState(type, id, type.equals("USER") ? "DISABLED" : "HIDDEN");
    }

    @ParameterizedTest
    @ValueSource(strings = {"DEMAND", "SERVICE_PACKAGE", "USER"})
    void committedReportTargetAndAuditFieldsAgree(String type) throws Exception {
        long id = type.equals("USER") ? owner.getId() : target(type);
        long reportId = create(type, id);
        String resolution = type.equals("USER") ? "RESTRICT_USER" : "TAKE_DOWN";
        resolve(reportId, resolution, adminToken, 200);
        var saved = reports.findById(reportId).orElseThrow();
        assertThat(saved.getReporterId()).isEqualTo(reporter.getId());
        assertThat(saved.getTargetId()).isEqualTo(id);
        assertThat(saved.getTargetType().name()).isEqualTo(type);
        assertThat(saved.getAdminId()).isEqualTo(admin.getId());
        assertThat(saved.getResolution().name()).isEqualTo(resolution);
        assertThat(saved.getAdminComment()).isEqualTo("reviewed");
        assertThat(saved.getReason()).isEqualTo("reason");
        assertThat(saved.getResolvedAt()).isNotNull();
        assertThat(saved.getResolvedAt()).isAfterOrEqualTo(saved.getCreatedAt());
        assertThat(saved.getActiveDedupeKey()).isNull();
        var records = audits.findAll();
        assertThat(records).hasSize(2);
        var targetAudit = records.stream().filter(audit -> audit.getAuditType().equals(type)).findFirst().orElseThrow();
        var reportAudit = records.stream().filter(audit -> audit.getAuditType().equals("REPORT")).findFirst().orElseThrow();
        assertThat(targetAudit.getTargetId()).isEqualTo(id);
        assertThat(targetAudit.getAuditResult()).isEqualTo(type.equals("USER") ? "DISABLE" : "TAKE_DOWN");
        assertThat(targetAudit.getRemark()).isEqualTo("reviewed");
        assertThat(reportAudit.getTargetId()).isEqualTo(reportId);
        assertThat(reportAudit.getAuditResult()).isEqualTo("RESOLVE");
        assertThat(reportAudit.getRemark()).isEqualTo(resolution + ": reviewed");
        records.forEach(audit -> {
            assertThat(audit.getAdminId()).isEqualTo(admin.getId());
            assertThat(audit.getCreatedAt()).isNotNull();
        });
        assertTargetState(type, id, type.equals("USER") ? "DISABLED" : "HIDDEN");
        if (type.equals("DEMAND")) assertThat(demands.findById(id).orElseThrow().getStatus().name()).isEqualTo("OPEN");
        if (type.equals("SERVICE_PACKAGE")) assertThat(services.findById(id).orElseThrow().getStatus().name()).isEqualTo("ONLINE");
        System.out.printf("MYSQL_AUDIT type=%s targetId=%d reportId=%d adminId=%d action=%s auditCount=2%n",
                type, id, reportId, admin.getId(), resolution);
    }

    @ParameterizedTest
    @ValueSource(strings = {"DEMAND", "SERVICE_PACKAGE", "USER"})
    void finalAuditFailureAfterFlushedWritesRollsBackEveryChange(String type) throws Exception {
        long id = type.equals("USER") ? owner.getId() : target(type);
        long reportId = create(type, id);
        String resolution = type.equals("USER") ? "RESTRICT_USER" : "TAKE_DOWN";
        AtomicBoolean reached = new AtomicBoolean();
        doAnswer(invocation -> {
            entityManager.flush();
            assertThat(jdbc.queryForObject("SELECT status FROM reports WHERE id=?", String.class, reportId)).isEqualTo("RESOLVED");
            assertTargetState(type, id, type.equals("USER") ? "DISABLED" : "HIDDEN");
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_records", Long.class)).isEqualTo(1);
            reached.set(true);
            throw new IllegalStateException("injected final audit failure after real MySQL writes");
        }).when(auditService).record(eq("REPORT"), eq(reportId), eq(admin.getId()), eq("RESOLVE"), anyString());
        resolve(reportId, resolution, adminToken, 50001);
        assertThat(reached).isTrue();
        var report = reports.findById(reportId).orElseThrow();
        assertThat(report.getStatus().name()).isEqualTo("PENDING");
        assertThat(report.getAdminId()).isNull();
        assertThat(report.getResolvedAt()).isNull();
        assertThat(report.getResolution()).isNull();
        assertThat(report.getActiveDedupeKey()).isNotNull();
        assertTargetState(type, id, type.equals("USER") ? "ACTIVE" : "VISIBLE");
        assertThat(audits.count()).isZero();
        System.out.printf("MYSQL_ROLLBACK type=%s reportId=%d flushed=true status=PENDING auditCount=0%n", type, reportId);
    }

    private void assertTargetState(String type, long id, String state) {
        String table = type.equals("USER") ? "users" : type.equals("DEMAND") ? "demands" : "service_packages";
        String column = type.equals("USER") ? "status" : "moderation_status";
        assertThat(jdbc.queryForObject("SELECT " + column + " FROM " + table + " WHERE id=?", String.class, id)).isEqualTo(state);
    }

    private List<Integer> concurrent(Callable<Integer> first, Callable<Integer> second) throws Exception {
        var executor = Executors.newFixedThreadPool(2);
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        try {
            var one = executor.submit(() -> { ready.countDown(); start.await(); return first.call(); });
            var two = executor.submit(() -> { ready.countDown(); start.await(); return second.call(); });
            if (!ready.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Workers not ready");
            start.countDown();
            return List.of(one.get(30, TimeUnit.SECONDS), two.get(30, TimeUnit.SECONDS));
        } finally {
            executor.shutdownNow();
            UserContext.clear();
        }
    }
}