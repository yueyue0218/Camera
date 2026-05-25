package com.action.camera.message.repository;

import com.action.camera.message.entity.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    Optional<Conversation> findBySourceTypeAndSourceIdAndParticipantAIdAndParticipantBId(
            String sourceType, Long sourceId, Long participantAId, Long participantBId);
}
