package com.action.camera.tempstaging;

import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TempStagingStartupGateTest {

    @Test
    void acceptsOnlyExpectedProfileDatabaseAndWhitelist() {
        Environment environment = validEnvironment();
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForObject("SELECT DATABASE()", String.class)).thenReturn("portra_staging");

        TempStagingStartupGate gate = new TempStagingStartupGate(environment, jdbcTemplate);

        assertDoesNotThrow(gate::afterPropertiesSet);
        assertDoesNotThrow(() -> {
            if (!gate.allows(101L) || !gate.allows(202L) || gate.allows(303L)) {
                throw new AssertionError("Unexpected allowlist");
            }
        });
    }

    @Test
    void rejectsMixedProfiles() {
        Environment environment = validEnvironment();
        when(environment.getActiveProfiles()).thenReturn(new String[]{"temp-staging", "prod"});
        TempStagingStartupGate gate = new TempStagingStartupGate(environment, mock(JdbcTemplate.class));

        assertThrows(IllegalStateException.class, gate::afterPropertiesSet);
    }

    @Test
    void rejectsWrongActualDatabase() {
        Environment environment = validEnvironment();
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForObject("SELECT DATABASE()", String.class)).thenReturn("camera_app");
        TempStagingStartupGate gate = new TempStagingStartupGate(environment, jdbcTemplate);

        assertThrows(IllegalStateException.class, gate::afterPropertiesSet);
    }

    @Test
    void rejectsEmptyWhitelist() {
        Environment environment = validEnvironment();
        when(environment.getProperty("TEMP_STAGING_ALLOWED_TEST_USER_IDS", "")).thenReturn("");
        TempStagingStartupGate gate = new TempStagingStartupGate(environment, mock(JdbcTemplate.class));

        assertThrows(IllegalStateException.class, gate::afterPropertiesSet);
    }

    private Environment validEnvironment() {
        Environment environment = mock(Environment.class);
        when(environment.getActiveProfiles()).thenReturn(new String[]{"temp-staging"});
        when(environment.getProperty("spring.datasource.url", ""))
                .thenReturn("jdbc:mysql://127.0.0.1:3306/portra_staging?useUnicode=true");
        when(environment.getProperty("spring.datasource.username", "")).thenReturn("portra_app");
        when(environment.getProperty("server.address", "")).thenReturn("127.0.0.1");
        when(environment.getProperty("server.port", "")).thenReturn("8080");
        when(environment.getProperty("TEMP_STAGING_ALLOWED_TEST_USER_IDS", "")).thenReturn("101,202");
        return environment;
    }
}
