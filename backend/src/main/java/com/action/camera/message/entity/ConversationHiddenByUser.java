package com.action.camera.message.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "conversation_hidden_by_user",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_conversation_hidden_user",
                columnNames = {"conversation_id", "user_id"}),
        indexes = {
                @Index(name = "idx_conversation_hidden_user", columnList = "user_id,hidden_at"),
                @Index(name = "idx_conversation_hidden_conversation", columnList = "conversation_id")
        })
public class ConversationHiddenByUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "conversation_id", nullable = false)
    private Long conversationId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "hidden_at", nullable = false)
    private LocalDateTime hiddenAt;

    public ConversationHiddenByUser(Long conversationId, Long userId) {
        this.conversationId = conversationId;
        this.userId = userId;
    }

    @PrePersist
    void prePersist() {
        if (hiddenAt == null) {
            hiddenAt = LocalDateTime.now();
        }
    }
}
