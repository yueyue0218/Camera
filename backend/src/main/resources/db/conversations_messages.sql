-- C module conversation/message persistence migration.
-- Keeps Conversation/Message JPA mappings executable when Hibernate ddl-auto is disabled.

CREATE TABLE IF NOT EXISTS conversations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    participant_a_id BIGINT NOT NULL,
    participant_b_id BIGINT NOT NULL,
    source_type VARCHAR(40) NOT NULL,
    source_id BIGINT NULL,
    last_message_time DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_conversation_source_pair (source_type, source_id, participant_a_id, participant_b_id),
    KEY idx_conversation_a_time (participant_a_id, last_message_time),
    KEY idx_conversation_b_time (participant_b_id, last_message_time),
    CONSTRAINT fk_conversation_a FOREIGN KEY (participant_a_id) REFERENCES users(id),
    CONSTRAINT fk_conversation_b FOREIGN KEY (participant_b_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='One-to-one conversations from demand response, service package, portfolio or direct source';

CREATE TABLE IF NOT EXISTS messages (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    conversation_id BIGINT NOT NULL,
    sender_id BIGINT NOT NULL,
    message_type VARCHAR(30) NOT NULL,
    content TEXT NULL,
    file_id BIGINT NULL,
    reference_type VARCHAR(40) NULL,
    reference_id BIGINT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_message_conversation_time (conversation_id, created_at),
    KEY idx_message_sender_time (sender_id, created_at),
    KEY idx_message_reference (reference_type, reference_id),
    CONSTRAINT fk_message_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    CONSTRAINT fk_message_sender FOREIGN KEY (sender_id) REFERENCES users(id),
    CONSTRAINT fk_message_file FOREIGN KEY (file_id) REFERENCES files(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Text/image messages';

CREATE TABLE IF NOT EXISTS conversation_hidden_by_user (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    conversation_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    hidden_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_conversation_hidden_user (conversation_id, user_id),
    KEY idx_conversation_hidden_user (user_id, hidden_at),
    KEY idx_conversation_hidden_conversation (conversation_id),
    CONSTRAINT fk_conversation_hidden_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    CONSTRAINT fk_conversation_hidden_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='User-scoped hidden conversations';

DELIMITER //

DROP PROCEDURE IF EXISTS c_add_index_if_missing//
CREATE PROCEDURE c_add_index_if_missing(
    IN p_table_name VARCHAR(64),
    IN p_index_name VARCHAR(64),
    IN p_index_definition TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = p_table_name
          AND index_name = p_index_name
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', p_table_name, '` ADD ', p_index_definition);
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END//

DELIMITER ;

CALL c_add_index_if_missing(
    'conversations',
    'uk_conversation_source_pair',
    'UNIQUE KEY uk_conversation_source_pair (source_type, source_id, participant_a_id, participant_b_id)'
);
CALL c_add_index_if_missing(
    'conversations',
    'idx_conversation_a_time',
    'INDEX idx_conversation_a_time (participant_a_id, last_message_time)'
);
CALL c_add_index_if_missing(
    'conversations',
    'idx_conversation_b_time',
    'INDEX idx_conversation_b_time (participant_b_id, last_message_time)'
);
CALL c_add_index_if_missing(
    'messages',
    'idx_message_conversation_time',
    'INDEX idx_message_conversation_time (conversation_id, created_at)'
);
CALL c_add_index_if_missing(
    'messages',
    'idx_message_sender_time',
    'INDEX idx_message_sender_time (sender_id, created_at)'
);
CALL c_add_index_if_missing(
    'messages',
    'idx_message_reference',
    'INDEX idx_message_reference (reference_type, reference_id)'
);
CALL c_add_index_if_missing(
    'conversation_hidden_by_user',
    'uk_conversation_hidden_user',
    'UNIQUE KEY uk_conversation_hidden_user (conversation_id, user_id)'
);
CALL c_add_index_if_missing(
    'conversation_hidden_by_user',
    'idx_conversation_hidden_user',
    'INDEX idx_conversation_hidden_user (user_id, hidden_at)'
);
CALL c_add_index_if_missing(
    'conversation_hidden_by_user',
    'idx_conversation_hidden_conversation',
    'INDEX idx_conversation_hidden_conversation (conversation_id)'
);

DROP PROCEDURE IF EXISTS c_add_index_if_missing;
