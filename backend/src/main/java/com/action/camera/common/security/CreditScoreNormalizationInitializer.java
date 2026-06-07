package com.action.camera.common.security;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * One-time credit reset for existing users after the scoring model switches to
 * the new 100-point baseline.
 */
@Component
public class CreditScoreNormalizationInitializer implements ApplicationRunner {

    private static final String MIGRATION_KEY = "credit_score_reset_to_100_v1";

    private final JdbcTemplate jdbcTemplate;

    public CreditScoreNormalizationInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        jdbcTemplate.execute("""
                create table if not exists system_migrations (
                    migration_key varchar(128) primary key,
                    applied_at datetime not null
                )
                """);

        Integer applied = jdbcTemplate.queryForObject(
                "select count(*) from system_migrations where migration_key = ?",
                Integer.class,
                MIGRATION_KEY
        );
        if (applied != null && applied > 0) {
            return;
        }

        jdbcTemplate.update("""
                update users
                   set credit_score = 100.00,
                       updated_at = now()
                 where credit_score <> 100.00
                """);
        jdbcTemplate.update(
                "insert into system_migrations (migration_key, applied_at) values (?, now())",
                MIGRATION_KEY
        );
    }
}
