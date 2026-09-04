package com.action.camera.demand;

import com.action.camera.common.page.PageResult;
import com.action.camera.demand.domain.Demand;
import com.action.camera.demand.dto.DemandDto;
import com.action.camera.demand.repository.DemandRepository;
import com.action.camera.demand.repository.DemandResponseRepository;
import com.action.camera.demand.service.DemandService;
import com.action.camera.domain.User;
import com.action.camera.message.service.ConversationService;
import com.action.camera.notification.service.NotificationService;
import com.action.camera.repository.UserRepository;
import com.action.camera.servicepackage.repository.ServicePackageRepository;
import org.junit.jupiter.api.Test;
import org.mockito.Answers;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class DemandA4BehaviorTest {

    @Test
    void latestUsesDatabasePageAndTotalThenLoadsCustomersInOneBatch() {
        Demand selected = demand(12L, 202L, "NJ", "fresh");
        DemandRepository repository = mock(DemandRepository.class, invocation -> {
            if (invocation.getMethod().getName().equals("findByStatus")) {
                throw new AssertionError("普通 latest 路径不得加载全部 OPEN 需求");
            }
            if (invocation.getMethod().getName().equals("findPublicPage")) {
                return new PageImpl<>(List.of(selected), PageRequest.of(1, 2), 7);
            }
            return Answers.RETURNS_DEFAULTS.answer(invocation);
        });
        AtomicInteger batchCalls = new AtomicInteger();
        UserRepository users = users(Map.of(202L, user(202L, "Publisher 202")), batchCalls);
        DemandService service = service(repository, users);

        PageResult<DemandDto> result = service.listDemands(
                2, 2, "NJ", "PORTRAIT", "OPEN", null, "fresh",
                20_000, 50_000, "NEAR_7_DAYS", "stable", "latest", null, null);

        assertThat(result.getPage()).isEqualTo(2);
        assertThat(result.getSize()).isEqualTo(2);
        assertThat(result.getTotal()).isEqualTo(7);
        assertThat(result.getRecords()).extracting(DemandDto::getDemandId).containsExactly(12L);
        assertThat(result.getRecords()).extracting(DemandDto::getCustomerNickname).containsExactly("Publisher 202");
        assertThat(batchCalls).hasValue(1);
    }

    @Test
    void missingCustomerKeepsDemandAndNullablePublisherFields() {
        Demand selected = demand(21L, 999L, "NJ", "fresh");
        DemandRepository repository = mock(DemandRepository.class, invocation -> {
            if (invocation.getMethod().getName().equals("findPublicPage")) {
                return new PageImpl<>(List.of(selected), PageRequest.of(0, 10), 1);
            }
            return Answers.RETURNS_DEFAULTS.answer(invocation);
        });
        DemandService service = service(repository, users(Map.of(), new AtomicInteger()));

        PageResult<DemandDto> result = service.listDemands(1, 10, null, null, null);

        assertThat(result.getRecords()).hasSize(1);
        assertThat(result.getRecords().get(0).getCustomerNickname()).isNull();
        assertThat(result.getRecords().get(0).getCustomerAvatarFileId()).isNull();
    }

    @Test
    void recommendKeepsFullOrderingAcrossPagesAndUsesOneCustomerBatch() {
        List<Demand> demands = new ArrayList<>();
        Map<Long, User> userValues = new LinkedHashMap<>();
        for (long id = 1; id <= 12; id++) {
            long customerId = 300L + id;
            demands.add(demand(id, customerId, "C" + id, "s" + id));
            userValues.put(customerId, user(customerId, "P" + id));
        }
        DemandRepository repository = mock(DemandRepository.class, invocation -> {
            if (invocation.getMethod().getName().equals("findByStatus")) {
                return demands;
            }
            if (invocation.getMethod().getName().equals("findPublicPage")) {
                throw new AssertionError("recommend 必须保留完整候选集语义");
            }
            return Answers.RETURNS_DEFAULTS.answer(invocation);
        });
        AtomicInteger batchCalls = new AtomicInteger();
        DemandService service = service(repository, users(userValues, batchCalls));

        PageResult<DemandDto> page1 = service.listDemands(
                1, 6, null, null, null, null, null, null, null,
                null, null, "recommend", "demand-seed", null);
        PageResult<DemandDto> page2 = service.listDemands(
                2, 6, null, null, null, null, null, null, null,
                null, null, "recommend", "demand-seed", null);
        List<Long> fullOrder = new ArrayList<>(ids(page1));
        fullOrder.addAll(ids(page2));

        assertThat(fullOrder).containsExactly(4L, 3L, 2L, 12L, 1L, 11L, 10L, 9L, 8L, 7L, 6L, 5L);
        assertThat(page1.getTotal()).isEqualTo(12);
        assertThat(page2.getTotal()).isEqualTo(12);
        assertThat(page1.getRecords().get(0).getCustomerNickname()).isEqualTo("P4");
        assertThat(page1.getRecords().get(0).getRecommendReasons()).containsExactly("近期需求", "响应较少", "信息完整");
        assertThat(batchCalls).hasValue(2);
    }

    private DemandService service(DemandRepository repository, UserRepository users) {
        return new DemandService(
                repository,
                mock(DemandResponseRepository.class),
                mock(ConversationService.class),
                mock(NotificationService.class),
                users,
                mock(ServicePackageRepository.class));
    }

    private UserRepository users(Map<Long, User> values, AtomicInteger batchCalls) {
        return mock(UserRepository.class, invocation -> {
            if (invocation.getMethod().getName().equals("findAllById")) {
                batchCalls.incrementAndGet();
                Collection<?> requested = iterable(invocation.getArgument(0));
                return requested.stream().map(id -> values.get((Long) id)).filter(java.util.Objects::nonNull).toList();
            }
            if (invocation.getMethod().getName().equals("findById")) {
                throw new AssertionError("列表 DTO 不得循环调用 UserRepository.findById");
            }
            return Answers.RETURNS_DEFAULTS.answer(invocation);
        });
    }

    private Collection<?> iterable(Iterable<?> values) {
        List<Object> result = new ArrayList<>();
        values.forEach(result::add);
        return result;
    }

    private User user(Long id, String nickname) {
        User user = new User();
        user.setId(id);
        user.setNickname(nickname);
        user.setAvatarFileId(id + 1000);
        user.setCurrentRole("CUSTOMER");
        user.setStatus("ACTIVE");
        return user;
    }

    private Demand demand(Long id, Long customerId, String city, String style) {
        Demand demand = new Demand(
                customerId,
                "PORTRAIT",
                List.of(style),
                LocalDate.of(2026, 10, 1),
                "AFTERNOON",
                "Weekend availability",
                List.of("WEEKEND"),
                city,
                "Campus",
                20_000,
                50_000,
                "Complete stable demand",
                List.of(1L),
                LocalDateTime.of(2026, 9, 1, 10, 0),
                LocalDateTime.of(2026, 10, 1, 10, 0));
        demand.setId(id);
        return demand;
    }

    private List<Long> ids(PageResult<DemandDto> page) {
        return page.getRecords().stream().map(DemandDto::getDemandId).toList();
    }
}
