package com.action.camera.schema;

import com.action.camera.message.config.ConversationSchemaInitializer;
import com.action.camera.social.config.MomentSchemaInitializer;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.jdbc.core.JdbcTemplate;
import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class LegacySchemaInitializerBehaviorTest {
    @Test
    void legacyMysqlConversationStillCreatesAndUpgradesMissingStructures() throws Exception {
        JdbcTemplate jdbc=mysql();
        when(jdbc.queryForObject(anyString(),eq(Integer.class),any(Object[].class)))
                .thenAnswer(invocation -> invocation.<String>getArgument(0).contains("information_schema.tables") ? 1 : 0);
        new ConversationSchemaInitializer(jdbc).run(new DefaultApplicationArguments());
        ArgumentCaptor<String> sql=ArgumentCaptor.forClass(String.class);
        verify(jdbc,times(9)).execute(sql.capture());
        assertThat(sql.getAllValues()).anyMatch(s -> s.contains("create table if not exists conversation_hidden_by_user"));
        assertThat(sql.getAllValues()).anyMatch(s -> s.contains("alter table conversations add column order_id"));
        assertThat(sql.getAllValues()).anyMatch(s -> s.contains("alter table messages add column file_id"));
        assertThat(sql.getAllValues()).anyMatch(s -> s.contains("(source_type, source_id, participant_a_id, participant_b_id, order_id)"));
    }

    @Test
    void legacyMysqlMomentStillUpgradesNarrowImageColumn() throws Exception {
        JdbcTemplate jdbc=mysql();
        when(jdbc.queryForObject(anyString(),eq(Integer.class))).thenReturn(1);
        when(jdbc.queryForObject(anyString(),eq(String.class))).thenReturn("varchar");
        new MomentSchemaInitializer(jdbc).run(new DefaultApplicationArguments());
        verify(jdbc).execute("alter table moment_images modify column image_data mediumtext not null");
    }

    @Test
    void legacyMysqlMomentAlreadyMigratedDoesNotAlter() throws Exception {
        JdbcTemplate jdbc=mysql();
        when(jdbc.queryForObject(anyString(),eq(Integer.class))).thenReturn(1);
        when(jdbc.queryForObject(anyString(),eq(String.class))).thenReturn("mediumtext");
        new MomentSchemaInitializer(jdbc).run(new DefaultApplicationArguments());
        verify(jdbc,never()).execute(anyString());
    }

    private JdbcTemplate mysql() throws Exception {
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        DataSource ds=mock(DataSource.class);
        Connection connection=mock(Connection.class);
        DatabaseMetaData meta=mock(DatabaseMetaData.class);
        when(jdbc.getDataSource()).thenReturn(ds);
        when(ds.getConnection()).thenReturn(connection);
        when(connection.getMetaData()).thenReturn(meta);
        when(meta.getDatabaseProductName()).thenReturn("MySQL");
        return jdbc;
    }
}
