package com.action.camera.common.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Seeds the two demo users used by the local frontend.
 */
@Component
@Profile({"dev", "smoke"})
public class DemoUserInitializer implements ApplicationRunner {

    private static final long DEMO_CUSTOMER_ID = 1001L;
    private static final long DEMO_PROVIDER_ID = 2001L;

    private final JdbcTemplate jdbcTemplate;
    private final boolean seedDemoUsers;

    public DemoUserInitializer(JdbcTemplate jdbcTemplate,
                               @Value("${camera.demo.seed-users:false}") boolean seedDemoUsers) {
        this.jdbcTemplate = jdbcTemplate;
        this.seedDemoUsers = seedDemoUsers;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!seedDemoUsers) {
            return;
        }
        ensureUser(DEMO_CUSTOMER_ID, "闇€姹傛柟婕旂ず鐢ㄦ埛", UserRole.CUSTOMER.name());
        ensureUser(DEMO_PROVIDER_ID, "鏈嶅姟鏂规紨绀虹敤鎴?", UserRole.PROVIDER.name());
        ensureRoleBinding(DEMO_CUSTOMER_ID, UserRole.CUSTOMER.name());
        ensureRoleBinding(DEMO_PROVIDER_ID, UserRole.PROVIDER.name());
    }

    private void ensureUser(long userId, String nickname, String role) {
        Integer count = jdbcTemplate.queryForObject(
                "select count(*) from users where id = ?",
                Integer.class,
                userId
        );
        if (count != null && count > 0) {
            return;
        }
        jdbcTemplate.update(
                """
                        insert into users
                            (id, nickname, current_role, status, credit_score, created_at, updated_at)
                        values
                            (?, ?, ?, 'ACTIVE', 80.00, now(), now())
                        """,
                userId,
                nickname,
                role
        );
    }

    private void ensureRoleBinding(long userId, String role) {
        Integer count = jdbcTemplate.queryForObject(
                "select count(*) from user_role_bindings where user_id = ? and role = ?",
                Integer.class,
                userId,
                role
        );
        if (count != null && count > 0) {
            return;
        }
        jdbcTemplate.update(
                "insert into user_role_bindings (user_id, role, granted_at) values (?, ?, now())",
                userId,
                role
        );
    }

}
