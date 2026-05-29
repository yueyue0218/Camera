package com.action.camera.message.repository;

import com.action.camera.message.entity.Quote;
import com.action.camera.message.enums.QuoteStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface QuoteRepository extends JpaRepository<Quote, Long> {

    Optional<Quote> findFirstByConversationIdAndStatus(Long conversationId, QuoteStatus status);

    List<Quote> findByConversationIdOrderByCreatedAtDesc(Long conversationId);

    List<Quote> findByConversationIdAndStatusOrderByCreatedAtDesc(Long conversationId, QuoteStatus status);

    boolean existsBySourceTypeAndSourceId(String sourceType, Long sourceId);

    boolean existsBySourceTypeAndSourceIdAndStatusIn(String sourceType, Long sourceId, Collection<QuoteStatus> statuses);
}
