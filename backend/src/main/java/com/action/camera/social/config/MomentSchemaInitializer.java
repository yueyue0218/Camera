package com.action.camera.social.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;

/**
 * Keeps legacy moment tables compatible with the current image payload size.
 * Older databases may still have moment_images.image_data as VARCHAR(2048),
 * which rejects compressed base64 uploads from the frontend.
 */
@Component
public class MomentSchemaInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(MomentSchemaInitializer.class);

    private final JdbcTemplate jdbcTemplate;

    public MomentSchemaInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            if (!isMySql()) {
                return;
            }
            Integer tableCount = jdbcTemplate.queryForObject(
                    """
                            select count(*)
                            from information_schema.tables
                            where table_schema = database()
                              and table_name = 'moment_images'
                            """,
                    Integer.class
            );
            if (tableCount == null || tableCount == 0) {
                return;
            }
            String dataType = jdbcTemplate.queryForObject(
                    """
                            select data_type
                            from information_schema.columns
                            where table_schema = database()
                              and table_name = 'moment_images'
                              and column_name = 'image_data'
                            """,
                    String.class
            );
            if (dataType == null) {
                log.warn("moment_images.image_data column not found; skipping schema compatibility check");
                return;
            }
            if ("mediumtext".equalsIgnoreCase(dataType) || "longtext".equalsIgnoreCase(dataType)) {
                return;
            }
            jdbcTemplate.execute("alter table moment_images modify column image_data mediumtext not null");
            log.info("Upgraded moment_images.image_data from {} to MEDIUMTEXT", dataType);
        } catch (Exception ex) {
            log.warn("Failed to verify or upgrade moment_images.image_data column", ex);
        }
    }

    private boolean isMySql() throws Exception {
        DataSource dataSource = jdbcTemplate.getDataSource();
        if (dataSource == null) {
            return false;
        }
        try (Connection connection = dataSource.getConnection()) {
            return "MySQL".equalsIgnoreCase(connection.getMetaData().getDatabaseProductName());
        }
    }
}
