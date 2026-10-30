package com.action.camera.message.repository;

import com.action.camera.message.entity.Conversation;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Conversation c where c.id = :id")
    Optional<Conversation> findByIdForUpdate(@Param("id") Long id);

    Optional<Conversation> findBySourceTypeAndSourceIdAndParticipantAIdAndParticipantBIdAndOrderId(
            String sourceType, Long sourceId, Long participantAId, Long participantBId, Long orderId);

    List<Conversation> findByParticipantAIdOrParticipantBId(Long participantAId, Long participantBId);
}
