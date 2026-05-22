package com.action.camera.message.repository;

import com.action.camera.message.entity.Quote;
import com.action.camera.message.enums.QuoteStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface QuoteRepository extends JpaRepository<Quote, Long> {

    Optional<Quote> findFirstByConversationIdAndStatus(Long conversationId, QuoteStatus status);
}
