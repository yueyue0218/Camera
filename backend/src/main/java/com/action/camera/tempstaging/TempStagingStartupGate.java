package com.action.camera.tempstaging;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.Set;

@Component
@Profile("temp-staging")
public class TempStagingStartupGate implements InitializingBean {

    private static final int MAX_TEST_USERS = 10;
    private final Environment environment;
    private final JdbcTemplate jdbcTemplate;
    private Set<Long> allowedTestUserIds = Set.of();

    public TempStagingStartupGate(Environment environment, JdbcTemplate jdbcTemplate) {
        this.environment = environment;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void afterPropertiesSet() {
        String[] profiles = environment.getActiveProfiles();
        if (profiles.length != 1 || !"temp-staging".equals(profiles[0])) {
            throw new IllegalStateException("temp-staging must be the only active profile");
        }
        String url = environment.getProperty("spring.datasource.url", "");
        if (!url.startsWith("jdbc:mysql://127.0.0.1:3306/portra_staging?")) {
            throw new IllegalStateException("temp-staging requires the local portra_staging JDBC URL");
        }
        if (!"portra_app".equals(environment.getProperty("spring.datasource.username", ""))) {
            throw new IllegalStateException("temp-staging requires portra_app");
        }
        if (!"127.0.0.1".equals(environment.getProperty("server.address", ""))
                || !"8080".equals(environment.getProperty("server.port", ""))) {
            throw new IllegalStateException("temp-staging must bind 127.0.0.1:8080");
        }

        String rawIds = environment.getProperty("TEMP_STAGING_ALLOWED_TEST_USER_IDS", "");
        if (!rawIds.matches("[1-9][0-9]*(,[1-9][0-9]*)*")) {
            throw new IllegalStateException("TEMP_STAGING_ALLOWED_TEST_USER_IDS must be nonempty numeric IDs");
        }
        Set<Long> ids = new HashSet<>();
        try {
            for (String token : rawIds.split(",")) {
                if (!ids.add(Long.parseLong(token))) {
                    throw new IllegalStateException("Duplicate temp-staging test user ID");
                }
            }
        } catch (NumberFormatException e) {
            throw new IllegalStateException("Invalid temp-staging test user ID", e);
        }
        if (ids.size() > MAX_TEST_USERS) {
            throw new IllegalStateException("Too many temp-staging test user IDs");
        }

        String database = jdbcTemplate.queryForObject("SELECT DATABASE()", String.class);
        if (!"portra_staging".equals(database)) {
            throw new IllegalStateException("temp-staging database identity mismatch");
        }
        allowedTestUserIds = Set.copyOf(ids);
    }

    public boolean allows(Long userId) {
        return userId != null && allowedTestUserIds.contains(userId);
    }
}
