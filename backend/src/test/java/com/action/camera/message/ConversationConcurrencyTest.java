package com.action.camera.message;

import com.action.camera.message.model.CreateConversationCommand;
import com.action.camera.message.entity.Message;
import com.action.camera.message.repository.ConversationHiddenByUserRepository;
import com.action.camera.message.repository.ConversationRepository;
import com.action.camera.message.repository.MessageRepository;
import com.action.camera.message.service.ConversationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:conversation_concurrency_test;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;NON_KEYWORDS=CURRENT_ROLE;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect"
})
class ConversationConcurrencyTest {

    private static final long CUSTOMER_ID = 1001L;
    private static final long PROVIDER_ID = 2001L;
    private static final long SOURCE_ID = 7001L;

    @Autowired
    private ConversationService conversationService;

    @Autowired
    private ConversationRepository conversationRepository;

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private ConversationHiddenByUserRepository hiddenByUserRepository;

    @BeforeEach
    void cleanDatabase() {
        hiddenByUserRepository.deleteAll();
        messageRepository.deleteAll();
        conversationRepository.deleteAll();
    }

    @Test
    void concurrentCreateConversationWithSameSourceReturnsSingleConversation() throws Exception {
        int workers = 12;
        ExecutorService executor = Executors.newFixedThreadPool(workers);
        CountDownLatch ready = new CountDownLatch(workers);
        CountDownLatch start = new CountDownLatch(1);

        List<Future<Long>> futures = IntStream.range(0, workers)
                .mapToObj(index -> executor.submit(() -> {
                    ready.countDown();
                    assertThat(start.await(5, TimeUnit.SECONDS)).isTrue();
                    return conversationService.createConversationWithInitialMessage(new CreateConversationCommand(
                            CUSTOMER_ID,
                            PROVIDER_ID,
                            CUSTOMER_ID,
                            ConversationService.SOURCE_TYPE_SERVICE_PACKAGE,
                            SOURCE_ID,
                            "I would like to reserve this service package."
                    )).getConversationId();
                }))
                .toList();

        assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
        start.countDown();

        Set<Long> conversationIds = futures.stream()
                .map(future -> {
                    try {
                        return future.get(10, TimeUnit.SECONDS);
                    } catch (Exception e) {
                        throw new AssertionError(e);
                    }
                })
                .collect(java.util.stream.Collectors.toSet());
        executor.shutdownNow();

        assertThat(conversationIds).hasSize(1);
        Long conversationId = conversationIds.iterator().next();
        assertThat(conversationRepository.count()).isEqualTo(1);
        assertThat(messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId)).hasSize(1);
    }

    @Test
    void participantHideConversationOnlyRemovesItFromOwnListWithoutDeletingRecords() {
        Long conversationId = conversationService.createConversationWithInitialMessage(new CreateConversationCommand(
                CUSTOMER_ID,
                PROVIDER_ID,
                CUSTOMER_ID,
                ConversationService.SOURCE_TYPE_DEMAND_RESPONSE,
                SOURCE_ID + 1,
                "Initial demand response conversation."
        )).getConversationId();
        Message followUp = messageRepository.save(message(conversationId, PROVIDER_ID, "Follow up message"));

        conversationService.hideConversation(conversationId, CUSTOMER_ID);

        assertThat(conversationService.listMyConversations(CUSTOMER_ID))
                .extracting("id")
                .doesNotContain(conversationId);
        assertThat(conversationService.listMyConversations(PROVIDER_ID))
                .extracting("id")
                .contains(conversationId);
        assertThat(conversationRepository.findById(conversationId)).isPresent();
        assertThat(messageRepository.findById(followUp.getId())).isPresent();
        assertThat(messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId)).hasSize(2);
        assertThat(conversationRepository.findById(conversationId).orElseThrow().getSourceType())
                .isEqualTo(ConversationService.SOURCE_TYPE_DEMAND_RESPONSE);
    }

    @Test
    void nonParticipantCannotHideConversation() {
        Long conversationId = conversationService.createConversationWithInitialMessage(new CreateConversationCommand(
                CUSTOMER_ID,
                PROVIDER_ID,
                CUSTOMER_ID,
                ConversationService.SOURCE_TYPE_SERVICE_PACKAGE,
                SOURCE_ID + 2,
                "Initial service package conversation."
        )).getConversationId();

        org.assertj.core.api.Assertions.assertThatThrownBy(
                        () -> conversationService.hideConversation(conversationId, 3001L))
                .isInstanceOf(com.action.camera.common.exception.BusinessException.class);

        assertThat(hiddenByUserRepository.count()).isZero();
        assertThat(conversationRepository.findById(conversationId)).isPresent();
    }

    private Message message(Long conversationId, Long senderId, String content) {
        Message message = new Message();
        message.setConversationId(conversationId);
        message.setSenderId(senderId);
        message.setMessageType("TEXT");
        message.setContent(content);
        message.setIsRead(false);
        message.setCreatedAt(java.time.LocalDateTime.now());
        return message;
    }
}
