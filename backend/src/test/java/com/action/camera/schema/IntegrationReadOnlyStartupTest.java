package com.action.camera.schema;

import com.action.camera.CameraApplication;
import com.action.camera.message.config.ConversationSchemaInitializer;
import com.action.camera.social.config.MomentSchemaInitializer;
import jakarta.persistence.EntityManagerFactory;
import org.junit.jupiter.api.Test;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.datasource.AbstractDataSource;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;

import javax.sql.DataSource;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.sql.*;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.*;

/** Real Boot/JPA startup against a local, prebuilt fixture; never an ECS database. */
class IntegrationReadOnlyStartupTest {
    @Test
    void bootValidatesAllEntitiesWithoutAnyRuntimeDdl() throws Exception {
        DriverManagerDataSource fixture = fixture();
        DdlGuard guard = new DdlGuard(fixture);
        try (ConfigurableApplicationContext context = start(guard)) {
            assertThat(context.getEnvironment().getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate");
            assertThat(context.getEnvironment().getProperty("spring.sql.init.mode")).isEqualTo("never");
            assertThat(context.getBeansOfType(ConversationSchemaInitializer.class)).isEmpty();
            assertThat(context.getBeansOfType(MomentSchemaInitializer.class)).isEmpty();
            EntityManagerFactory emf = context.getBean(EntityManagerFactory.class);
            assertThat(emf.getProperties().get("hibernate.hbm2ddl.auto")).isEqualTo("validate");
            assertThat(emf.getMetamodel().getEntities()).hasSize(37);
            assertThat(guard.ddlAttempts).isEmpty();
        }
        // Closing the context must not issue create-drop cleanup either.
        assertThat(guard.ddlAttempts).isEmpty();
        closeFixture(fixture);
    }

    @Test
    void missingMappedTableFailsValidationInsteadOfRepairingSchema() throws Exception {
        DriverManagerDataSource fixture = fixture();
        try (Connection c=fixture.getConnection(); Statement s=c.createStatement()) {
            s.execute("DROP TABLE privacy_consent_events"); // Fixture setup only, before the guard.
        }
        DdlGuard guard = new DdlGuard(fixture);
        assertThatThrownBy(() -> {
            try (ConfigurableApplicationContext ignored = start(guard)) {
                throw new AssertionError("Startup unexpectedly accepted a missing mapped table");
            }
        }).hasStackTraceContaining("Schema-validation: missing table [privacy_consent_events]");
        assertThat(guard.ddlAttempts).isEmpty();
        closeFixture(fixture);
    }

    private ConfigurableApplicationContext start(DataSource dataSource) {
        return new SpringApplicationBuilder(CameraApplication.class)
                .web(WebApplicationType.NONE).profiles("integration")
                .initializers(context -> context.getBeanFactory().registerSingleton("dataSource", dataSource))
                .run("--spring.main.banner-mode=off", "--spring.jmx.enabled=false");
    }

    private DriverManagerDataSource fixture() throws SQLException {
        DriverManagerDataSource ds = new DriverManagerDataSource(
                "jdbc:h2:mem:ddl_guard_" + UUID.randomUUID().toString().replace("-", "")
                        + ";MODE=MySQL;DATABASE_TO_LOWER=TRUE;NON_KEYWORDS=CURRENT_ROLE;DB_CLOSE_DELAY=-1", "sa", "");
        LocalContainerEntityManagerFactoryBean emf = new LocalContainerEntityManagerFactoryBean();
        emf.setDataSource(ds);
        emf.setPackagesToScan("com.action.camera");
        emf.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        emf.setJpaPropertyMap(Map.of(
                "hibernate.hbm2ddl.auto", "create",
                "hibernate.physical_naming_strategy", "org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy",
                "hibernate.implicit_naming_strategy", "org.springframework.boot.orm.jpa.hibernate.SpringImplicitNamingStrategy"));
        emf.afterPropertiesSet();
        emf.destroy();
        // H2 aliases MySQL MEDIUMTEXT to VARCHAR, whereas @Lob expects JDBC CLOB.
        // Adapt only the disposable H2 fixture, never the production mapping/SQL.
        try (Connection c=ds.getConnection(); Statement s=c.createStatement()) {
            s.execute("ALTER TABLE moment_images ALTER COLUMN image_data CLOB NOT NULL");
        }
        return ds;
    }

    private void closeFixture(DataSource ds) throws SQLException {
        try (Connection c=ds.getConnection(); Statement s=c.createStatement()) { s.execute("SHUTDOWN"); }
    }

    private static final class DdlGuard extends AbstractDataSource {
        private static final Pattern DDL = Pattern.compile("(?is)^\\s*(create|alter|drop|truncate|rename|comment|grant|revoke)\\b");
        private final DataSource delegate;
        private final List<String> ddlAttempts = new CopyOnWriteArrayList<>();
        DdlGuard(DataSource delegate) { this.delegate = delegate; }
        @Override public Connection getConnection() throws SQLException { return wrap(delegate.getConnection(), Connection.class); }
        @Override public Connection getConnection(String user, String password) throws SQLException { return wrap(delegate.getConnection(user,password),Connection.class); }
        private void check(String sql) throws SQLException {
            String clean=sql.replaceAll("(?s)/\\*.*?\\*/", "").replaceAll("(?m)--[^\\r\\n]*", "");
            if (DDL.matcher(clean).find()) {
                ddlAttempts.add(sql);
                throw new SQLException("Runtime DDL forbidden by test guard");
            }
        }
        private <T> T wrap(T target, Class<T> type) {
            return type.cast(Proxy.newProxyInstance(type.getClassLoader(),new Class<?>[]{type},(proxy,method,args)->{
                if (args!=null && args.length>0 && args[0] instanceof String sql
                        && (method.getName().startsWith("prepare") || method.getName().startsWith("execute") || method.getName().equals("addBatch"))) check(sql);
                try {
                    Object result=method.invoke(target,args);
                    if(result instanceof CallableStatement statement) return wrap(statement,CallableStatement.class);
                    if(result instanceof PreparedStatement statement) return wrap(statement,PreparedStatement.class);
                    if(result instanceof Statement statement) return wrap(statement,Statement.class);
                    return result;
                } catch(InvocationTargetException e) { throw e.getCause(); }
            }));
        }
    }
}
