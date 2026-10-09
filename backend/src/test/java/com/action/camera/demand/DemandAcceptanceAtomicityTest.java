package com.action.camera.demand;

import com.action.camera.common.security.CurrentUser;
import com.action.camera.common.security.UserRole;
import com.action.camera.demand.domain.DemandResponseStatus;
import com.action.camera.demand.dto.CreateDemandRequest;
import com.action.camera.demand.dto.CreateDemandResponseRequest;
import com.action.camera.demand.repository.DemandRepository;
import com.action.camera.demand.repository.DemandResponseRepository;
import com.action.camera.demand.service.DemandService;
import com.action.camera.message.repository.ConversationRepository;
import com.action.camera.message.repository.MessageRepository;
import com.action.camera.notification.dto.NotificationCreateRequest;
import com.action.camera.notification.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.when;

@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:demand_atomicity_test;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;NON_KEYWORDS=CURRENT_ROLE;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class DemandAcceptanceAtomicityTest {

    private static final CurrentUser CUSTOMER = new CurrentUser(1001L, UserRole.CUSTOMER);
    private static final CurrentUser PROVIDER = new CurrentUser(2001L, UserRole.PROVIDER);

    @Autowired private DemandService demandService;
    @Autowired private DemandRepository demandRepository;
    @Autowired private DemandResponseRepository responseRepository;
    @Autowired private ConversationRepository conversationRepository;
    @Autowired private MessageRepository messageRepository;
    @MockBean private NotificationService notificationService;

    @BeforeEach
    void setUp() {
        reset(notificationService);
        messageRepository.deleteAll();
        conversationRepository.deleteAll();
        responseRepository.deleteAll();
        demandRepository.deleteAll();
    }

    @Test
    void failureAfterConversationCreationRollsBackResponseConversationAndMessage() {
        long[] ids = createDemandAndResponse();
        when(notificationService.createNotification(any(NotificationCreateRequest.class)))
                .thenThrow(new IllegalStateException("notification unavailable"));

        assertThatThrownBy(() -> demandService.acceptResponse(ids[0], ids[1], CUSTOMER))
                .isInstanceOf(IllegalStateException.class);

        assertThat(responseRepository.findById(ids[1]).orElseThrow().getStatus())
                .isEqualTo(DemandResponseStatus.PENDING_CUSTOMER_ACCEPT);
        assertThat(conversationRepository.count()).isZero();
        assertThat(messageRepository.count()).isZero();
    }

    @Test
    void repeatedAcceptanceCannotCreateAnotherConversation() {
        long[] ids = createDemandAndResponse();
        Long conversationId = demandService.acceptResponse(ids[0], ids[1], CUSTOMER).getConversationId();

        assertThatThrownBy(() -> demandService.acceptResponse(ids[0], ids[1], CUSTOMER))
                .isInstanceOf(RuntimeException.class);
        assertThat(conversationRepository.count()).isEqualTo(1);
        assertThat(messageRepository.count()).isEqualTo(1);
        assertThat(conversationRepository.findById(conversationId)).isPresent();
    }

    @Test
    void concurrentAcceptanceCreatesOnlyOneConversation() throws Exception {
        long[] ids = createDemandAndResponse();
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            var first = executor.submit(() -> acceptAfterStart(start, ids));
            var second = executor.submit(() -> acceptAfterStart(start, ids));
            start.countDown();
            int successes = (first.get(10, TimeUnit.SECONDS) ? 1 : 0)
                    + (second.get(10, TimeUnit.SECONDS) ? 1 : 0);
            assertThat(successes).isEqualTo(1);
        } finally {
            executor.shutdownNow();
        }
        assertThat(conversationRepository.count()).isEqualTo(1);
        assertThat(messageRepository.count()).isEqualTo(1);
    }

    private boolean acceptAfterStart(CountDownLatch start, long[] ids) throws InterruptedException {
        start.await();
        try {
            demandService.acceptResponse(ids[0], ids[1], CUSTOMER);
            return true;
        } catch (RuntimeException expectedConflict) {
            return false;
        }
    }

    private long[] createDemandAndResponse() {
        CreateDemandRequest request = new CreateDemandRequest();
        request.setScene("PORTRAIT");
        request.setCityCode("NJ");
        request.setLocation("City center");
        request.setTimeDescription("Weekend afternoon");
        request.setDescription("Portrait session");
        Long demandId = demandService.createDemand(CUSTOMER, request).getDemandId();

        CreateDemandResponseRequest response = new CreateDemandResponseRequest();
        response.setMessage("Available this weekend");
        Long responseId = demandService.respondToDemand(demandId, PROVIDER, response).getResponseId();
        return new long[]{demandId, responseId};
    }
}
