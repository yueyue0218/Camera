package com.action.camera.message.repository;

import com.action.camera.message.entity.ConversationHiddenByUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.Optional;
import java.util.Set;

public interface ConversationHiddenByUserRepository extends JpaRepository<ConversationHiddenByUser, Long> {

    Optional<ConversationHiddenByUser> findByConversationIdAndUserId(Long conversationId, Long userId);

    @Query("""
            select h.conversationId from ConversationHiddenByUser h
            where h.userId = :userId
              and h.conversationId in :conversationIds
            """)
    Set<Long> findHiddenConversationIds(@Param("userId") Long userId,
                                        @Param("conversationIds") Collection<Long> conversationIds);
}
