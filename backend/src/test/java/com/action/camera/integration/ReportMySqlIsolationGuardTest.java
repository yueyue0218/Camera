package com.action.camera.integration;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.context.DynamicPropertyRegistry;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Tests only bootstrap guard ordering, without opening a database connection. */
class ReportMySqlIsolationGuardTest {
    @TempDir Path temporaryDirectory;
    private static final String EXPECTED_DIRECTORY =
            "C:/Users/LiXiaozhou/.codex/test-environments/portra-mysql-3307/data/";

    @Test void stage3RejectsWrongIdentityBeforeAnyWrite() throws Exception {
        String previous=System.getProperty("portra.mysql.stage3");
        System.setProperty("portra.mysql.stage3","true");
        try {
            for (String mismatch : java.util.List.of("port","schema","url","directory")) {
                var checked=new AtomicBoolean();
                Connection c=connection("MySQL", "C:/Users/ww/.codex/visualizations/2026/11/02/01a19cf9-7d01-7590-847b-50ac5e651d24/portra-backend-integration/evidence/stage2/mysql-data/",checked);
                when(c.getMetaData().getURL()).thenReturn("jdbc:mysql://127.0.0.1:33367/portragovp0test?sslMode=DISABLED");
                var rs=c.createStatement().executeQuery("SELECT @@port, @@datadir");
                when(rs.getInt(1)).thenReturn(33367);
                switch(mismatch) {
                    case "port" -> when(rs.getInt(1)).thenReturn(3306);
                    case "schema" -> when(c.getCatalog()).thenReturn("production");
                    case "url" -> when(c.getMetaData().getURL()).thenReturn("jdbc:mysql://remote:33367/portragovp0test");
                    case "directory" -> when(rs.getString(2)).thenReturn("C:/other/mysql");
                }
                assertThatThrownBy(()->ReportMySqlClosureIT.validateStartupIdentity(c)).isInstanceOf(IllegalStateException.class);
            }
        } finally { if(previous==null) System.clearProperty("portra.mysql.stage3"); else System.setProperty("portra.mysql.stage3",previous); }
    }

    @Test
    void wrongDataDirectoryIsRejectedBeforeAnyDatasourcePropertyIsRegistered() throws Exception {
        rejected("MySQL", "C:/unrelated/data/");
    }

    @Test
    void h2IsRejectedBeforeAnyDatasourcePropertyIsRegistered() throws Exception {
        rejected("H2", EXPECTED_DIRECTORY);
    }

    @Test
    void verifiedMysqlIdentityPrecedesEveryDatasourcePropertyRegistration() throws Exception {
        var checked = new AtomicBoolean();
        Connection connection = connection("MySQL", EXPECTED_DIRECTORY, checked);
        var registry = mock(DynamicPropertyRegistry.class);
        doAnswer(invocation -> {
            assertThat(checked).as("identity query must finish before property registration").isTrue();
            return null;
        }).when(registry).add(anyString(), any());
        withFakeClientConfig(() -> {
            try (var driver = mockStatic(DriverManager.class)) {
                driver.when(() -> DriverManager.getConnection(anyString(), anyString(), anyString())).thenReturn(connection);
                ReportMySqlClosureIT.useIsolatedMySql(registry);
                assertThat(checked).isTrue();
                driver.verify(() -> DriverManager.getConnection(anyString(), anyString(), anyString()));
                verify(connection).close();
                verify(registry, atLeastOnce()).add(anyString(), any());
            }
        });
    }

    private void rejected(String product, String directory) throws Exception {
        Connection connection = connection(product, directory, new AtomicBoolean());
        var registry = mock(DynamicPropertyRegistry.class);
        withFakeClientConfig(() -> {
            try (var driver = mockStatic(DriverManager.class)) {
                driver.when(() -> DriverManager.getConnection(anyString(), anyString(), anyString())).thenReturn(connection);
                assertThatThrownBy(() -> ReportMySqlClosureIT.useIsolatedMySql(registry))
                        .isInstanceOf(IllegalStateException.class);
                verifyNoInteractions(registry);
            }
        });
    }

    private Connection connection(String product, String directory, AtomicBoolean checked) throws Exception {
        var connection = mock(Connection.class);
        var metadata = mock(DatabaseMetaData.class);
        var statement = mock(Statement.class);
        var result = mock(ResultSet.class);
        when(connection.getMetaData()).thenReturn(metadata);
        when(metadata.getDatabaseProductName()).thenReturn(product);
        when(metadata.getURL()).thenReturn("jdbc:mysql://127.0.0.1:3307/portragovp0test?sslMode=DISABLED");
        when(connection.getCatalog()).thenReturn("portragovp0test");
        when(connection.createStatement()).thenReturn(statement);
        when(statement.executeQuery(anyString())).thenReturn(result);
        when(result.next()).thenReturn(true);
        when(result.getInt(1)).thenReturn(3307);
        when(result.getString(2)).thenAnswer(invocation -> {
            checked.set(true);
            return directory;
        });
        return connection;
    }

    private void withFakeClientConfig(ThrowingRunnable operation) throws Exception {
        Path config = temporaryDirectory.resolve("client.ini");
        Files.writeString(config, "[client]\nhost=127.0.0.1\nport=3307\nuser=portra_gov_test\n"
                + "database=portragovp0test\npassword=inert-test-password\n");
        String previous = System.getProperty("portra.mysql.clientConfig");
        try {
            System.setProperty("portra.mysql.clientConfig", config.toString());
            operation.run();
        } finally {
            if (previous == null) System.clearProperty("portra.mysql.clientConfig");
            else System.setProperty("portra.mysql.clientConfig", previous);
        }
    }

    @FunctionalInterface
    private interface ThrowingRunnable { void run() throws Exception; }
}
