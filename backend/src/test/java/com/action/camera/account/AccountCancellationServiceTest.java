package com.action.camera.account;

import com.action.camera.account.domain.AccountCancellationRequest;
import com.action.camera.account.domain.AccountCancellationStatus;
import com.action.camera.account.dto.AccountCancellationResponse;
import com.action.camera.account.repository.AccountCancellationRequestRepository;
import com.action.camera.account.service.AccountCancellationService;
import com.action.camera.domain.User;
import com.action.camera.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:account_cancellation_test;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;NON_KEYWORDS=CURRENT_ROLE;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(AccountCancellationService.class)
class AccountCancellationServiceTest {

    @Autowired
    private AccountCancellationService service;

    @Autowired
    private AccountCancellationRequestRepository requestRepository;

    @Autowired
    private UserRepository userRepository;

    private User user;

    @BeforeEach
    void setUp() {
        requestRepository.deleteAll();
        userRepository.deleteAll();
        user = new User();
        user.setNickname("Cancellation User");
        user.setCurrentRole("CUSTOMER");
        user.setStatus("ACTIVE");
        user = userRepository.saveAndFlush(user);
    }

    @Test
    void statusIsExplicitWhenNoRequestExists() {
        AccountCancellationResponse response = service.getStatus(user.getId());

        assertThat(response.getStatus()).isEqualTo("NOT_REQUESTED");
        assertThat(response.getRequestId()).isNull();
    }

    @Test
    void requestIsPersistedWithNormalizedReason() {
        AccountCancellationResponse response = service.request(user.getId(), "  暂不使用  ");

        assertThat(response.getStatus()).isEqualTo("PENDING");
        assertThat(response.getReason()).isEqualTo("暂不使用");
        assertThat(response.getRequestId()).isNotNull();
        assertThat(requestRepository.findByUserId(user.getId())).isPresent();
    }

    @Test
    void repeatedPendingRequestIsIdempotent() {
        AccountCancellationResponse first = service.request(user.getId(), "first");
        AccountCancellationResponse second = service.request(user.getId(), "second");

        assertThat(second.getRequestId()).isEqualTo(first.getRequestId());
        assertThat(second.getReason()).isEqualTo("first");
        assertThat(requestRepository.count()).isEqualTo(1);
    }

    @Test
    void rejectedRequestCanBeSubmittedAgain() {
        AccountCancellationResponse first = service.request(user.getId(), "first");
        AccountCancellationRequest stored = requestRepository.findById(first.getRequestId()).orElseThrow();
        stored.setStatus(AccountCancellationStatus.REJECTED);
        stored.setProcessedAt(LocalDateTime.now());
        stored.setResolutionNote("存在未完成订单");
        requestRepository.saveAndFlush(stored);

        AccountCancellationResponse resubmitted = service.request(user.getId(), " issue resolved ");

        assertThat(resubmitted.getRequestId()).isEqualTo(first.getRequestId());
        assertThat(resubmitted.getStatus()).isEqualTo("PENDING");
        assertThat(resubmitted.getReason()).isEqualTo("issue resolved");
        assertThat(resubmitted.getProcessedAt()).isNull();
        assertThat(resubmitted.getResolutionNote()).isNull();
    }
}
