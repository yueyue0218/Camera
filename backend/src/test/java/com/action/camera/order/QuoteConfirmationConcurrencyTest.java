package com.action.camera.order;

import com.action.camera.domain.User;
import com.action.camera.message.entity.Conversation;
import com.action.camera.message.entity.Quote;
import com.action.camera.message.enums.QuoteStatus;
import com.action.camera.message.model.CreateQuoteCommand;
import com.action.camera.message.repository.ConversationRepository;
import com.action.camera.message.repository.QuoteRepository;
import com.action.camera.message.service.QuoteService;
import com.action.camera.order.entity.Order;
import com.action.camera.order.enums.OrderStatus;
import com.action.camera.order.repository.OrderRepository;
import com.action.camera.order.repository.OrderStatusLogRepository;
import com.action.camera.order.repository.PaymentRecordRepository;
import com.action.camera.order.service.OrderService;
import com.action.camera.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.TestPropertySource;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.Callable;
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
    @Autowired private OrderService orderService;
    @Autowired private ConversationRepository conversationRepository;
    @Autowired private PaymentRecordRepository paymentRecordRepository;
    @Autowired private OrderStatusLogRepository orderStatusLogRepository;
    @Autowired private UserRepository userRepository;
    private Long providerId;

    @BeforeEach
    void clear() {
        orderStatusLogRepository.deleteAll();
        paymentRecordRepository.deleteAll();
        orderRepository.deleteAll();
        quoteRepository.deleteAll();
        conversationRepository.deleteAll();
        userRepository.deleteAll();
        User provider = new User();
        provider.setNickname("Photographer");
        provider.setCurrentRole("PROVIDER");
        providerId = userRepository.save(provider).getId();
    }

    @Test
    void concurrentCreatesInOneConversationLeaveOnePendingQuote() throws Exception {
        Conversation conversation = new Conversation();
        conversation.setParticipantAId(1001L);
        conversation.setParticipantBId(providerId);
        conversation.setSourceType("DEMAND_RESPONSE");
        conversation.setSourceId(3001L);
        Long conversationId = conversationRepository.save(conversation).getId();

        List<Boolean> outcomes = race(
                () -> createQuote(conversationId),
                () -> createQuote(conversationId));

        assertThat(outcomes).containsExactlyInAnyOrder(true, false);
        assertThat(quoteRepository.findByConversationIdAndStatusOrderByCreatedAtDesc(
                conversationId, QuoteStatus.PENDING_CONFIRM)).hasSize(1);
    }

    @Test
    void concurrentConfirmationAndRejectionHaveOneTerminalOutcome() throws Exception {
        Long quoteId = quoteRepository.save(pendingQuote()).getId();
        List<Boolean> outcomes = race(
                () -> attempt(() -> quoteService.confirmQuote(quoteId, 1001L, null)),
                () -> attempt(() -> quoteService.rejectQuote(quoteId, 1001L, null)));

        assertThat(outcomes).containsExactlyInAnyOrder(true, false);
        Quote quote = quoteRepository.findById(quoteId).orElseThrow();
        assertThat(quote.getStatus()).isIn(QuoteStatus.CONFIRMED, QuoteStatus.REJECTED);
        assertThat(orderRepository.count()).isEqualTo(quote.getStatus() == QuoteStatus.CONFIRMED ? 1 : 0);
    }

    @Test
    void concurrentEditAndConfirmationCannotChangeConfirmedOrder() throws Exception {
        Quote saved = quoteRepository.save(pendingQuote());
        Long quoteId = saved.getId();
        CreateQuoteCommand edit = command(saved.getConversationId());
        edit.setAmountCent(49900L);
        race(
                () -> attempt(() -> quoteService.updatePendingQuote(quoteId, edit, providerId)),
                () -> attempt(() -> quoteService.confirmQuote(quoteId, 1001L, null)));

        Quote finalQuote = quoteRepository.findById(quoteId).orElseThrow();
        Order order = orderRepository.findByQuoteId(quoteId).orElseThrow();
        assertThat(finalQuote.getStatus()).isEqualTo(QuoteStatus.CONFIRMED);
        assertThat(order.getTotalAmountCent()).isEqualTo(finalQuote.getAmountCent());
    }

    @Test
    void overlappingQuotesForOneProviderCannotBothBecomeOrders() throws Exception {
        Quote firstQuote = pendingQuote();
        Quote secondQuote = pendingQuote();
        secondQuote.setQuoteNo("Q" + System.nanoTime());
        secondQuote.setConversationId(9002L);
        secondQuote.setSourceId(3002L);
        Long firstId = quoteRepository.save(firstQuote).getId();
        Long secondId = quoteRepository.save(secondQuote).getId();

        List<Boolean> outcomes = race(
                () -> attempt(() -> quoteService.confirmQuote(firstId, 1001L, null)),
                () -> attempt(() -> quoteService.confirmQuote(secondId, 1001L, null)));

        assertThat(outcomes).containsExactlyInAnyOrder(true, false);
        assertThat(orderRepository.count()).isEqualTo(1);
    }

    @Test
    void concurrentPaymentsCreateOneRecordAndOnePaidTransition() throws Exception {
        Long orderId = confirmedOrderId();
        List<Boolean> outcomes = race(
                () -> attempt(() -> orderService.mockPay(orderId, 1001L, 39900L)),
                () -> attempt(() -> orderService.mockPay(orderId, 1001L, 39900L)));

        assertThat(outcomes).contains(true);
        assertThat(paymentRecordRepository.countByOrderId(orderId)).isEqualTo(1);
        assertThat(orderRepository.findById(orderId).orElseThrow().getStatus())
                .isEqualTo(OrderStatus.PAID_PENDING_SHOOT);
        assertThat(orderStatusLogRepository.findByOrderIdOrderByCreatedAtAsc(orderId)).hasSize(1);
    }

    @Test
    void paymentAndCancellationCannotProduceContradictoryFinalState() throws Exception {
        Long orderId = confirmedOrderId();
        race(
                () -> attempt(() -> orderService.mockPay(orderId, 1001L, 39900L)),
                () -> attempt(() -> orderService.cancelOrder(orderId, 1001L, null)));

        Order order = orderRepository.findById(orderId).orElseThrow();
        if (order.getStatus() == OrderStatus.CANCELLED) {
            assertThat(paymentRecordRepository.countByOrderId(orderId)).isZero();
        } else {
            assertThat(order.getStatus()).isEqualTo(OrderStatus.REFUNDED);
            assertThat(paymentRecordRepository.findByOrderId(orderId).orElseThrow().getStatus())
                    .isEqualTo("REFUNDED");
        }
    }

    private Long confirmedOrderId() {
        Long quoteId = quoteRepository.save(pendingQuote()).getId();
        return quoteService.confirmQuote(quoteId, 1001L, null).getId();
    }

    private boolean createQuote(Long conversationId) {
        return attempt(() -> quoteService.createQuoteFromConversation(command(conversationId), providerId));
    }

    private CreateQuoteCommand command(Long conversationId) {
        LocalDateTime start = LocalDateTime.now().plusDays(5).withNano(0);
        CreateQuoteCommand command = new CreateQuoteCommand();
        command.setConversationId(conversationId);
        command.setAmountCent(39900L);
        command.setShootStartTime(start);
        command.setShootEndTime(start.plusHours(2));
        command.setDeliveryDeadline(start.plusDays(7));
        command.setLocation("City center");
        command.setServiceContent("Portrait session");
        return command;
    }

    private boolean attempt(Runnable action) {
        try {
            action.run();
            return true;
        } catch (com.action.camera.common.exception.BusinessException ignored) {
            return false;
        }
    }

    private List<Boolean> race(Callable<Boolean> firstAction, Callable<Boolean> secondAction) throws Exception {
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            var first = executor.submit(() -> {
                ready.countDown();
                start.await();
                return firstAction.call();
            });
            var second = executor.submit(() -> {
                ready.countDown();
                start.await();
                return secondAction.call();
            });
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            return List.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS));
        } finally {
            executor.shutdownNow();
        }
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
        quote.setProviderUserId(providerId);
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
