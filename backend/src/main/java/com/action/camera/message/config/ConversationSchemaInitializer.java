package com.action.camera.message.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.List;

@Component
public class ConversationSchemaInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(ConversationSchemaInitializer.class);
    private static final List<String> CONVERSATION_SOURCE_INDEX_COLUMNS = List.of(
            "source_type",
            "source_id",
            "participant_a_id",
            "participant_b_id",
            "order_id"
    );

    private final JdbcTemplate jdbcTemplate;

    public ConversationSchemaInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            if (!isMySql() || !tableExists("conversations")) {
                return;
            }
            ensureConversationOrderId();
            ensureConversationIndexes();
            ensureHiddenConversationTable();
        } catch (Exception ex) {
            log.warn("Failed to verify or upgrade conversations schema", ex);
        }
    }

    private void ensureConversationOrderId() {
        if (!columnExists("conversations", "order_id")) {
            jdbcTemplate.execute("alter table conversations add column order_id bigint not null default 0 after source_id");
            log.info("Added conversations.order_id for service package conversation compatibility");
        }
    }

    private void ensureConversationIndexes() {
        ensureConversationSourceUniqueKey();
        addIndexIfMissing(
                "conversations",
                "idx_conversation_a_time",
                "index idx_conversation_a_time (participant_a_id, last_message_time)"
        );
        addIndexIfMissing(
                "conversations",
                "idx_conversation_b_time",
                "index idx_conversation_b_time (participant_b_id, last_message_time)"
        );
    }

    private void ensureConversationSourceUniqueKey() {
        String indexName = "uk_conversation_source_pair";
        if (!indexExists("conversations", indexName)) {
            jdbcTemplate.execute("""
                    alter table conversations
                    add unique key uk_conversation_source_pair
                    (source_type, source_id, participant_a_id, participant_b_id, order_id)
                    """);
            log.info("Added conversations.uk_conversation_source_pair for service package conversation compatibility");
            return;
        }

        List<String> columns = indexColumns("conversations", indexName);
        if (!CONVERSATION_SOURCE_INDEX_COLUMNS.equals(columns)) {
            log.warn(
                    "conversations.{} columns are {} but expected {}; run backend/src/main/resources/db/conversations_messages.sql during a maintenance window",
                    indexName,
                    columns,
                    CONVERSATION_SOURCE_INDEX_COLUMNS
            );
        }
    }

    private void ensureHiddenConversationTable() {
        if (!tableExists("users")) {
            return;
        }
        jdbcTemplate.execute("""
                create table if not exists conversation_hidden_by_user (
                    id bigint primary key auto_increment,
                    conversation_id bigint not null,
                    user_id bigint not null,
                    hidden_at datetime not null default current_timestamp,
                    unique key uk_conversation_hidden_user (conversation_id, user_id),
                    key idx_conversation_hidden_user (user_id, hidden_at),
                    key idx_conversation_hidden_conversation (conversation_id),
                    constraint fk_conversation_hidden_conversation foreign key (conversation_id) references conversations(id),
                    constraint fk_conversation_hidden_user foreign key (user_id) references users(id)
                ) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_0900_ai_ci comment='User-scoped hidden conversations'
                """);
        addIndexIfMissing(
                "conversation_hidden_by_user",
                "uk_conversation_hidden_user",
                "unique key uk_conversation_hidden_user (conversation_id, user_id)"
        );
        addIndexIfMissing(
                "conversation_hidden_by_user",
                "idx_conversation_hidden_user",
                "index idx_conversation_hidden_user (user_id, hidden_at)"
        );
        addIndexIfMissing(
                "conversation_hidden_by_user",
                "idx_conversation_hidden_conversation",
                "index idx_conversation_hidden_conversation (conversation_id)"
        );
    }

    private void addIndexIfMissing(String tableName, String indexName, String indexDefinition) {
        if (!indexExists(tableName, indexName)) {
            jdbcTemplate.execute("alter table " + tableName + " add " + indexDefinition);
        }
    }

    private boolean tableExists(String tableName) {
        Integer count = jdbcTemplate.queryForObject(
                """
                        select count(*)
                        from information_schema.tables
                        where table_schema = database()
                          and table_name = ?
                        """,
                Integer.class,
                tableName
        );
        return count != null && count > 0;
    }

    private boolean columnExists(String tableName, String columnName) {
        Integer count = jdbcTemplate.queryForObject(
                """
                        select count(*)
                        from information_schema.columns
                        where table_schema = database()
                          and table_name = ?
                          and column_name = ?
                        """,
                Integer.class,
                tableName,
                columnName
        );
        return count != null && count > 0;
    }

    private boolean indexExists(String tableName, String indexName) {
        Integer count = jdbcTemplate.queryForObject(
                """
                        select count(*)
                        from information_schema.statistics
                        where table_schema = database()
                          and table_name = ?
                          and index_name = ?
                        """,
                Integer.class,
                tableName,
                indexName
        );
        return count != null && count > 0;
    }

    private List<String> indexColumns(String tableName, String indexName) {
        return jdbcTemplate.queryForList(
                """
                        select column_name
                        from information_schema.statistics
                        where table_schema = database()
                          and table_name = ?
                          and index_name = ?
                        order by seq_in_index
                        """,
                String.class,
                tableName,
                indexName
        );
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
