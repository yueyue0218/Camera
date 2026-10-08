package com.action.camera.order;

import com.action.camera.message.entity.Quote;
import com.action.camera.message.enums.QuoteStatus;
import com.action.camera.message.repository.QuoteRepository;
import com.action.camera.message.service.QuoteService;
import com.action.camera.order.entity.Order;
import com.action.camera.order.repository.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.TestPropertySource;

import java.time.LocalDateTime;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:quote_concurrency_test;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;NON_KEYWORDS=CURRENT_ROLE;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class QuoteConfirmationConcurrencyTest {

    @Autowired private QuoteService quoteService;
    @Autowired private QuoteRepository quoteRepository;
    @Autowired private OrderRepository orderRepository;

    @BeforeEach
    void clear() {
        orderRepository.deleteAll();
        quoteRepository.deleteAll();
    }

    @Test
    void parallelConfirmationsReturnTheSameOrder() throws Exception {
        Long quoteId = quoteRepository.save(pendingQuote()).getId();
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            var first = executor.submit(() -> confirmAfterStart(start, quoteId));
            var second = executor.submit(() -> confirmAfterStart(start, quoteId));
            start.countDown();
            assertThat(first.get(10, TimeUnit.SECONDS)).isEqualTo(second.get(10, TimeUnit.SECONDS));
        } finally {
            executor.shutdownNow();
        }
        assertThat(orderRepository.count()).isEqualTo(1);
        assertThat(quoteRepository.findById(quoteId).orElseThrow().getStatus()).isEqualTo(QuoteStatus.CONFIRMED);
    }

    @Test
    void databaseRejectsSecondOrderForSameQuote() {
        Long quoteId = quoteRepository.save(pendingQuote()).getId();
        Order original = quoteService.confirmQuote(quoteId, 1001L, null);
        Order duplicate = new Order();
        duplicate.setQuoteId(quoteId);
        duplicate.setOrderNo("duplicate-" + quoteId);
        duplicate.setConversationId(original.getConversationId());
        duplicate.setCustomerId(original.getCustomerId());
        duplicate.setProviderUserId(original.getProviderUserId());
        duplicate.setStatus(original.getStatus());
        duplicate.setEscrowStatus(original.getEscrowStatus());
        duplicate.setSettlementStatus(original.getSettlementStatus());
        duplicate.setRefundStatus(original.getRefundStatus());
        duplicate.setTotalAmountCent(original.getTotalAmountCent());
        duplicate.setPlatformFeeCent(original.getPlatformFeeCent());
        duplicate.setProviderIncomeCent(original.getProviderIncomeCent());
        duplicate.setShootStartTime(original.getShootStartTime());
        duplicate.setShootEndTime(original.getShootEndTime());
        duplicate.setShootLocation(original.getShootLocation());
        duplicate.setDeliveryDeadline(original.getDeliveryDeadline());
        duplicate.setPhotoUsageScope(original.getPhotoUsageScope());
        duplicate.setQuoteSnapshotJson(original.getQuoteSnapshotJson());
        duplicate.setSafetyNoticeConfirmed(false);

        assertThatThrownBy(() -> orderRepository.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private Long confirmAfterStart(CountDownLatch start, Long quoteId) throws InterruptedException {
        start.await();
        return quoteService.confirmQuote(quoteId, 1001L, null).getId();
    }

    private Quote pendingQuote() {
        LocalDateTime start = LocalDateTime.now().plusDays(5).withNano(0);
        Quote quote = new Quote();
        quote.setQuoteNo("Q" + System.nanoTime());
        quote.setConversationId(9001L);
        quote.setProviderUserId(2001L);
        quote.setCustomerId(1001L);
        quote.setSourceType("DEMAND_RESPONSE");
        quote.setSourceId(3001L);
        quote.setAmountCent(39900L);
        quote.setShootStartTime(start);
        quote.setShootEndTime(start.plusHours(2));
        quote.setLocation("City center");
        quote.setServiceContent("Portrait session");
        quote.setOriginalCount(20);
        quote.setRefinedCount(5);
        quote.setDeliveryDeadline(start.plusDays(7));
        quote.setPhotoUsageScope("PERSONAL_ONLY");
        quote.setServiceSnapshotJson("{}");
        quote.setStatus(QuoteStatus.PENDING_CONFIRM);
        quote.setExpireTime(LocalDateTime.now().plusDays(1));
        return quote;
    }
}
