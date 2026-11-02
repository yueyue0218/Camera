package com.action.camera.demand;

import com.action.camera.admin.domain.ModerationStatus;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.common.security.UserRole;
import com.action.camera.demand.domain.Demand;
import com.action.camera.demand.domain.DemandStatus;
import com.action.camera.demand.repository.DemandRepository;
import com.action.camera.demand.service.DemandInterestService;
import com.action.camera.domain.User;
import com.action.camera.repository.UserRepository;
import com.action.camera.servicepackage.domain.ServicePackageInterest;
import com.action.camera.servicepackage.repository.ServicePackageInterestRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.*;

@DataJpaTest(properties = {"spring.jpa.defer-datasource-initialization=true", "spring.jpa.show-sql=false",
        "spring.datasource.url=jdbc:h2:mem:interest_test;MODE=MySQL;DATABASE_TO_LOWER=TRUE;NON_KEYWORDS=CURRENT_ROLE;DB_CLOSE_DELAY=-1"})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(DemandInterestService.class)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@Timeout(30)
class DemandInterestPersistenceTest {
    @Autowired DemandInterestService service;
    @Autowired ServicePackageInterestRepository interests;
    @Autowired DemandRepository demands;
    @Autowired UserRepository users;
    @Autowired PlatformTransactionManager transactions;

    @Test
    void addRemoveSurviveSeparateTransactionsAndAreIdempotent() {
        var provider = provider(); var demand = demand(9001L);
        var first = service.add(demand.getId(), provider);
        assertThat(first.interestId()).isPositive();
        assertThat(service.add(demand.getId(), provider).interestId()).isEqualTo(first.interestId());
        assertThat(service.state(demand.getId(), provider).interested()).isTrue();
        assertThat(service.list(provider, 1, 10).getTotal()).isEqualTo(1);
        service.remove(demand.getId(), provider); service.remove(demand.getId(), provider);
        assertThat(service.state(demand.getId(), provider).interested()).isFalse();
        assertThat(service.list(provider, 1, 10).getRecords()).isEmpty();
    }

    @Test
    void rolesOwnershipAndAccountIsolationAreEnforced() {
        var provider = provider(); var other = provider(); var demand = demand(9002L);
        var customer = new CurrentUser(provider.getUserId(), UserRole.CUSTOMER);
        assertThatThrownBy(() -> service.add(demand.getId(), customer)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.list(customer, 1, 10)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.state(demand.getId(), null)).isInstanceOf(BusinessException.class);
        var own = demand(provider.getUserId());
        assertThatThrownBy(() -> service.add(own.getId(), provider)).isInstanceOf(BusinessException.class);
        service.add(demand.getId(), provider);
        assertThat(service.state(demand.getId(), other).interested()).isFalse();
        service.remove(demand.getId(), other);
        assertThat(service.list(other, 1, 10).getRecords()).isEmpty();
        assertThat(service.state(demand.getId(), provider).interested()).isTrue();
    }

    @Test
    void newClosedExpiredDeletedAndInvisibleTargetsAreRejected() {
        var provider = provider();
        var closed = demand(9003L); update(closed.getId(), d -> d.setStatus(DemandStatus.CLOSED));
        var expired = demand(9003L); update(expired.getId(), d -> d.setExpireTime(LocalDateTime.now().minusDays(1)));
        var hidden = demand(9003L); update(hidden.getId(), d -> d.setHiddenByCustomer(true));
        var moderated = demand(9003L); update(moderated.getId(), d -> d.setModerationStatus(ModerationStatus.HIDDEN));
        for (var target : List.of(closed, expired, hidden, moderated)) {
            assertThatThrownBy(() -> service.add(target.getId(), provider)).isInstanceOf(BusinessException.class);
        }
        assertThatThrownBy(() -> service.add(Long.MAX_VALUE, provider)).isInstanceOf(BusinessException.class);
        assertThat(service.list(provider, 1, 10).getTotal()).isZero();
    }

    @Test
    void closedHistoryRemainsAndHiddenDeletedHistoryContainsNoPrivateContent() {
        var provider = provider(); var closed = demand(9004L); var hidden = demand(9004L); var deleted = demand(9004L);
        for (var d : List.of(closed, hidden, deleted)) { service.add(d.getId(), provider); }
        update(closed.getId(), d -> d.setStatus(DemandStatus.CLOSED));
        update(hidden.getId(), d -> d.setModerationStatus(ModerationStatus.HIDDEN));
        tx(() -> demands.deleteById(deleted.getId()));
        assertThat(service.state(closed.getId(), provider).demand().getStatus()).isEqualTo("CLOSED");
        assertThat(service.add(closed.getId(), provider).status()).isEqualTo("CLOSED");
        assertThat(service.state(hidden.getId(), provider).demand()).isNull();
        assertThat(service.state(deleted.getId(), provider).status()).isEqualTo("UNAVAILABLE");
        assertThat(service.list(provider, 1, 10).getRecords()).hasSize(3);
        service.remove(hidden.getId(), provider); service.remove(deleted.getId(), provider);
        assertThat(service.list(provider, 1, 10).getTotal()).isEqualTo(1);
    }

    @Test
    void paginationIsDatabaseBackedAndTargetTypesDoNotMix() {
        var provider = provider();
        for (int i = 0; i < 5; i++) { service.add(demand(9005L).getId(), provider); }
        tx(() -> { var legacy = new ServicePackageInterest(); legacy.setUserId(provider.getUserId());
            legacy.setServicePackageId(123456L); interests.saveAndFlush(legacy); });
        var first = service.list(provider, 1, 2); var second = service.list(provider, 2, 2); var last = service.list(provider, 3, 2);
        assertThat(first.getTotal()).isEqualTo(5);
        assertThat(first.getRecords()).hasSize(2); assertThat(second.getRecords()).hasSize(2); assertThat(last.getRecords()).hasSize(1);
        assertThat(first.getRecords()).doesNotContainAnyElementsOf(second.getRecords());
        assertThat(interests.findByUserIdOrderByCreatedAtDesc(provider.getUserId())).hasSize(1)
                .allMatch(i -> "SERVICE_PACKAGE".equals(i.getTargetType()));
        assertThat(interests.findByUserIdAndCreatedAtGreaterThanEqualOrderByCreatedAtDesc(provider.getUserId(),
                LocalDateTime.now().minusDays(1), org.springframework.data.domain.PageRequest.of(0, 20))).hasSize(1);
    }

    @Test
    void parallelDuplicateRequestsCreateOneRowAndDatabaseRejectsDuplicateTargets() throws Exception {
        var provider = provider(); var demand = demand(9006L);
        var executor = Executors.newFixedThreadPool(6);
        try {
            var jobs = new ArrayList<Callable<Long>>();
            for (int i = 0; i < 12; i++) { jobs.add(() -> service.add(demand.getId(), provider).interestId()); }
            var futures = executor.invokeAll(jobs, 15, TimeUnit.SECONDS);
            var ids = new ArrayList<Long>();
            for (var future : futures) { ids.add(future.get(1, TimeUnit.SECONDS)); }
            assertThat(ids.stream().distinct()).hasSize(1);
            assertThat(service.list(provider, 1, 10).getTotal()).isEqualTo(1);
            assertThatThrownBy(() -> tx(() -> {
                var duplicate = new ServicePackageInterest(); duplicate.setUserId(provider.getUserId());
                duplicate.setDemandId(demand.getId()); duplicate.setTargetType("DEMAND"); interests.saveAndFlush(duplicate);
            })).isInstanceOf(DataIntegrityViolationException.class);
        } finally { executor.shutdownNow(); assertThat(executor.awaitTermination(5, TimeUnit.SECONDS)).isTrue(); }
    }

    private CurrentUser provider() {
        var user = new User(); user.setNickname("摄影师测试"); user.setCurrentRole("PROVIDER");
        tx(() -> users.saveAndFlush(user));
        return new CurrentUser(user.getId(), UserRole.PROVIDER);
    }
    private Demand demand(Long customer) {
        var now = LocalDateTime.now();
        var d = new Demand(customer, "毕业约拍", List.of("自然"), null, "AFTERNOON", "时间可商量", List.of(),
                "江苏省", "校园", 10000, 20000, "需求说明", List.of(), now, now.plusDays(30));
        tx(() -> demands.saveAndFlush(d)); return d;
    }
    private void update(Long id, java.util.function.Consumer<Demand> change) {
        tx(() -> { var d = demands.findById(id).orElseThrow(); change.accept(d); demands.saveAndFlush(d); });
    }
    private void tx(Runnable work) { new TransactionTemplate(transactions).executeWithoutResult(s -> work.run()); }
}
