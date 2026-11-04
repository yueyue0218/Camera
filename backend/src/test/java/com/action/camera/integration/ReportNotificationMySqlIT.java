package com.action.camera.integration;

import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/** Same serialization/failure assertions as H2, against verified, migrated MySQL. */
class ReportNotificationMySqlIT extends ReportNotificationPrivacyTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired DataSource dataSource;
    @DynamicPropertySource static void isolated(DynamicPropertyRegistry registry) throws Exception {
        ReportMySqlClosureIT.useIsolatedMySql(registry);
    }
    @Override @BeforeEach void setup() {
        try(var connection=dataSource.getConnection()) {
            ReportMySqlClosureIT.validateStartupIdentity(connection);
        } catch(Exception failure) { throw new IllegalStateException("Isolation must precede writes",failure); }
        for(String table:java.util.List.of("notifications","privacy_consent_events","privacy_consents",
            "reports","audit_records","demand_responses","service_package_interests","user_sessions",
            "user_role_bindings","demands","service_packages","users")) jdbc.update("DELETE FROM "+table);
        super.setup();
    }
    @Test void withdrawnReporterCannotReadFeedbackEvenWithoutClientHeader() throws Exception {
        long id=create("DEMAND",target("DEMAND")); resolve(id,"IGNORE",adminToken,200);
        jdbc.update("UPDATE privacy_consents SET status='WITHDRAWN' WHERE user_id=?",reporter.getId());
        var result=json.readTree(mvc.perform(get("/reports/my").header("Authorization","Bearer "+reporterToken))
            .andReturn().getResponse().getContentAsString());
        assertThat(result.path("code").asInt()).isEqualTo(40302);
        assertThat(reports.findById(id)).isPresent();
    }
    @Test void cancelledReporterRetainsAuditButCannotReadWithOldSession() throws Exception {
        long id=create("DEMAND",target("DEMAND")); resolve(id,"IGNORE",adminToken,200);
        jdbc.update("UPDATE users SET status='CANCELLED' WHERE id=?",reporter.getId());
        var result=json.readTree(mvc.perform(get("/reports/my").header("Authorization","Bearer "+reporterToken))
            .andReturn().getResponse().getContentAsString());
        assertThat(result.path("code").asInt()).isEqualTo(40101);
        assertThat(reports.findById(id)).isPresent();
    }
}
