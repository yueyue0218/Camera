package com.action.camera.message.repository;

import com.action.camera.message.entity.Quote;
import com.action.camera.message.enums.QuoteStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface QuoteRepository extends JpaRepository<Quote, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select q from Quote q where q.id = :id")
    Optional<Quote> findByIdForUpdate(@Param("id") Long id);

    Optional<Quote> findFirstByConversationIdAndStatus(Long conversationId, QuoteStatus status);

    List<Quote> findByConversationIdOrderByCreatedAtDesc(Long conversationId);

    List<Quote> findByConversationIdAndStatusOrderByCreatedAtDesc(Long conversationId, QuoteStatus status);

    boolean existsBySourceTypeAndSourceId(String sourceType, Long sourceId);

    boolean existsBySourceTypeAndSourceIdAndStatusIn(String sourceType, Long sourceId, Collection<QuoteStatus> statuses);
}
