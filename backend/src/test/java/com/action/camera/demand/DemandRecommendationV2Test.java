package com.action.camera.demand;

import com.action.camera.application.FileReferenceValidator;
import com.action.camera.common.page.PageResult;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.common.security.UserRole;
import com.action.camera.demand.domain.Demand;
import com.action.camera.demand.domain.DemandStatus;
import com.action.camera.demand.dto.DemandDto;
import com.action.camera.demand.repository.DemandRepository;
import com.action.camera.demand.repository.DemandResponseRepository;
import com.action.camera.demand.service.DemandService;
import com.action.camera.domain.User;
import com.action.camera.message.service.ConversationService;
import com.action.camera.notification.service.NotificationService;
import com.action.camera.repository.UserRepository;
import com.action.camera.servicepackage.domain.ServicePackage;
import com.action.camera.servicepackage.domain.ServicePackageStatus;
import com.action.camera.servicepackage.repository.ServicePackageRepository;
import org.junit.jupiter.api.Test;
import org.mockito.Answers;
import org.springframework.data.domain.PageImpl;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class DemandRecommendationV2Test {

    @Test
    void eachDemandMatchesOneRealPackageInsteadOfSyntheticCrossPackageCapability() {
        LocalDate portraitDate = LocalDate.now().plusDays(5);
        LocalDate eventDate = LocalDate.now().plusDays(12);
        ServicePackage portrait = capability(
                1L, 900L, "NJ", "PORTRAIT", List.of("natural"), 110_000L,
                List.of(portraitDate), List.of("WEEKEND"));
        ServicePackage event = capability(
                2L, 900L, "SH", "EVENT", List.of("documentary"), 300_000L,
                List.of(eventDate), List.of("EVENING"));
        Demand portraitMatch = demand(
                1L, 101L, "NJ", "PORTRAIT", List.of("natural"), 100_000, 120_000,
                portraitDate, List.of("WEEKEND"));
        Demand eventMatch = demand(
                2L, 102L, "SH", "EVENT", List.of("documentary"), 280_000, 320_000,
                eventDate, List.of("EVENING"));
        Demand falseCombination = demand(
                3L, 103L, "NJ", "EVENT", List.of("documentary"), 280_000, 320_000,
                eventDate, List.of("EVENING"));

        PageResult<DemandDto> result = context(
                List.of(portraitMatch, eventMatch, falseCombination),
                List.of(portrait, event), Set.of()).service().listDemands(
                1, 10, null, null, null, null, null, null, null,
                null, null, "recommend", null, provider(900L));

        assertThat(ids(result).subList(0, 2)).containsExactlyInAnyOrder(1L, 2L);
        assertThat(ids(result)).endsWith(3L);
        assertThat(result.getRecords().stream()
                .filter(value -> value.getDemandId().equals(3L))
                .findFirst().orElseThrow().getRecommendReasons())
                .doesNotContain("同城匹配");
    }

    @Test
    void closerBudgetRanksHigherAndOnlyEvidenceBackedReasonIsReturned() {
        ServicePackage capability = capability(
                1L, 900L, "ZZ", "OTHER", List.of("other"), 120_000L, List.of(), List.of());
        Demand close = demand(
                1L, 101L, "NJ", "PORTRAIT", List.of("natural"), 100_000, 130_000,
                LocalDate.now().plusDays(5), List.of("WEEKEND"));
        Demand far = demand(
                2L, 102L, "SH", "EVENT", List.of("street"), 350_000, 450_000,
                LocalDate.now().plusDays(5), List.of("WEEKDAY"));

        PageResult<DemandDto> result = context(List.of(close, far), List.of(capability), Set.of())
                .service().listDemands(
                        1, 10, null, null, null, null, null, null, null,
                        null, null, "recommend", null, provider(900L));

        assertThat(ids(result)).containsExactly(1L, 2L);
        assertThat(result.getRecords().get(0).getRecommendReasons()).contains("预算适配");
        assertThat(result.getRecords().get(1).getRecommendReasons()).doesNotContain("预算适配");
    }

    @Test
    void incompatibleShootingTimeGetsNoTimeMatchReward() {
        LocalDate available = LocalDate.now().plusDays(8);
        ServicePackage capability = capability(
                1L, 900L, "ZZ", "OTHER", List.of("other"), 200_000L,
                List.of(available), List.of("WEEKEND"));
        Demand matching = demand(
                1L, 101L, "NJ", "PORTRAIT", List.of("natural"), 400_000, 500_000,
                available, List.of("WEEKEND"));
        Demand incompatible = demand(
                2L, 102L, "SH", "EVENT", List.of("street"), 400_000, 500_000,
                available.plusDays(1), List.of("WEEKDAY"));

        PageResult<DemandDto> result = context(List.of(matching, incompatible), List.of(capability), Set.of())
                .service().listDemands(
                        1, 10, null, null, null, null, null, null, null,
                        null, null, "recommend", null, provider(900L));

        assertThat(ids(result)).startsWith(1L);
        assertThat(result.getRecords().get(0).getRecommendReasons()).contains("拍摄时间匹配");
        assertThat(result.getRecords().get(1).getRecommendReasons()).doesNotContain("拍摄时间匹配");
    }

    @Test
    void ownClosedHiddenModeratedAndExpiredDemandsNeverEnterRecommendation() {
        Demand valid = demand(1L, 101L, "NJ", "PORTRAIT", List.of("natural"),
                100_000, 150_000, LocalDate.now().plusDays(5), List.of());
        Demand own = demand(2L, 900L, "NJ", "PORTRAIT", List.of("natural"),
                100_000, 150_000, LocalDate.now().plusDays(5), List.of());
        Demand closed = demand(3L, 103L, "NJ", "PORTRAIT", List.of("natural"),
                100_000, 150_000, LocalDate.now().plusDays(5), List.of());
        closed.setStatus(DemandStatus.CLOSED);
        Demand hidden = demand(4L, 104L, "NJ", "PORTRAIT", List.of("natural"),
                100_000, 150_000, LocalDate.now().plusDays(5), List.of());
        hidden.setHiddenByCustomer(true);
        Demand moderated = demand(5L, 105L, "NJ", "PORTRAIT", List.of("natural"),
                100_000, 150_000, LocalDate.now().plusDays(5), List.of());
        moderated.takeDown(1L, "policy", LocalDateTime.now());
        Demand expired = demand(6L, 106L, "NJ", "PORTRAIT", List.of("natural"),
                100_000, 150_000, LocalDate.now().plusDays(5), List.of());
        expired.setExpireTime(LocalDateTime.now().minusMinutes(1));

        PageResult<DemandDto> result = context(
                List.of(valid, own, closed, hidden, moderated, expired), List.of(), Set.of())
                .service().listDemands(
                        1, 10, null, null, null, null, null, null, null,
                        null, null, "recommend", null, provider(900L));

        assertThat(ids(result)).containsExactly(1L);
    }

    @Test
    void alreadyRespondedDemandIsDownranked() {
        ServicePackage capability = capability(
                1L, 900L, "NJ", "PORTRAIT", List.of("natural"), 110_000L, List.of(), List.of());
        Demand notResponded = demand(1L, 101L, "NJ", "PORTRAIT", List.of("natural"),
                100_000, 120_000, LocalDate.now().plusDays(5), List.of());
        Demand responded = demand(2L, 102L, "NJ", "PORTRAIT", List.of("natural"),
                100_000, 120_000, LocalDate.now().plusDays(5), List.of());

        PageResult<DemandDto> result = context(
                List.of(notResponded, responded), List.of(capability), Set.of(2L))
                .service().listDemands(
                        1, 10, null, null, null, null, null, null, null,
                        null, null, "recommend", null, provider(900L));

        assertThat(ids(result)).containsExactly(1L, 2L);
    }

    @Test
    void capabilityAndResponseQueriesRemainConstantAndPaginationIsStable() {
        ServicePackage capability = capability(
                1L, 900L, "NJ", "PORTRAIT", List.of("natural"), 110_000L, List.of(), List.of());
        List<Demand> candidates = new ArrayList<>();
        for (long id = 1; id <= 12; id++) {
            candidates.add(demand(id, 100L + id, "C" + id, "SCENE" + id, List.of("style" + id),
                    100_000, 150_000, LocalDate.now().plusDays(5), List.of()));
        }
        TestContext test = context(candidates, List.of(capability), Set.of());

        PageResult<DemandDto> full = test.service().listDemands(
                1, 12, null, null, null, null, null, null, null,
                null, null, "recommend", "stable-seed", provider(900L));

        assertThat(ids(full)).hasSize(12).doesNotHaveDuplicates();
        assertThat(full.getRecords()).allSatisfy(value ->
                assertThat(value.getRecommendReasons()).hasSizeLessThanOrEqualTo(3));
        assertThat(test.candidateQueries()).hasValue(1);
        assertThat(test.capabilityQueries()).hasValue(1);
        assertThat(test.responseQueries()).hasValue(1);
    }

    @Test
    void deterministicFixtureDocumentsMeaningfulV1ToV2TopFiveChange() {
        ServicePackage portrait = capability(
                1L, 900L, "NJ", "PORTRAIT", List.of("natural"), 110_000L, List.of(), List.of());
        ServicePackage event = capability(
                2L, 900L, "SH", "EVENT", List.of("documentary"), 300_000L, List.of(), List.of());
        List<Demand> candidates = List.of(
                demand(5L, 105L, "NJ", "EVENT", List.of("documentary"), 280_000, 320_000,
                        LocalDate.now().plusDays(5), List.of()),
                demand(4L, 104L, "HZ", "PRODUCT", List.of("commercial"), 200_000, 250_000,
                        LocalDate.now().plusDays(5), List.of()),
                demand(3L, 103L, "SH", "EVENT", List.of("documentary"), 280_000, 320_000,
                        LocalDate.now().plusDays(5), List.of()),
                demand(2L, 102L, "NJ", "PORTRAIT", List.of("natural"), 100_000, 120_000,
                        LocalDate.now().plusDays(5), List.of()),
                demand(1L, 101L, "BJ", "PORTRAIT", List.of("natural"), 100_000, 120_000,
                        LocalDate.now().plusDays(5), List.of()));

        List<Long> v1TopFive = List.of(5L, 2L, 3L, 1L, 4L);
        List<Long> v2TopFive = ids(context(candidates, List.of(portrait, event), Set.of())
                .service().listDemands(
                        1, 5, null, null, null, null, null, null, null,
                        null, null, "recommend", null, provider(900L)));

        assertThat(v2TopFive).containsExactly(3L, 2L, 5L, 1L, 4L).isNotEqualTo(v1TopFive);
    }

    private TestContext context(List<Demand> candidates,
                                List<ServicePackage> capabilities,
                                Set<Long> respondedIds) {
        AtomicInteger candidateQueries = new AtomicInteger();
        AtomicInteger capabilityQueries = new AtomicInteger();
        AtomicInteger responseQueries = new AtomicInteger();
        DemandRepository demandRepository = mock(DemandRepository.class, invocation -> {
            if (invocation.getMethod().getName().equals("findPublicPage")) {
                candidateQueries.incrementAndGet();
                return new PageImpl<>(candidates);
            }
            return Answers.RETURNS_DEFAULTS.answer(invocation);
        });
        ServicePackageRepository packageRepository = mock(ServicePackageRepository.class, invocation -> {
            if (invocation.getMethod().getName().equals(
                    "findByProviderIdAndStatusAndHiddenByProviderFalseOrderByUpdatedAtDescIdDesc")) {
                capabilityQueries.incrementAndGet();
                Long providerId = invocation.getArgument(0);
                return capabilities.stream()
                        .filter(value -> providerId.equals(value.getProviderId()))
                        .toList();
            }
            return Answers.RETURNS_DEFAULTS.answer(invocation);
        });
        DemandResponseRepository responseRepository = mock(DemandResponseRepository.class, invocation -> {
            if (invocation.getMethod().getName().equals("findDemandIdsByProviderIdAndDemandIdIn")) {
                responseQueries.incrementAndGet();
                Collection<?> requested = invocation.getArgument(1);
                return respondedIds.stream().filter(requested::contains).toList();
            }
            return Answers.RETURNS_DEFAULTS.answer(invocation);
        });
        Map<Long, User> users = new LinkedHashMap<>();
        candidates.forEach(value -> users.put(value.getCustomerId(), user(value.getCustomerId())));
        UserRepository userRepository = mock(UserRepository.class, invocation -> {
            if (invocation.getMethod().getName().equals("findAllById")) {
                Collection<?> ids = iterable(invocation.getArgument(0));
                return ids.stream().map(id -> users.get((Long) id)).filter(java.util.Objects::nonNull).toList();
            }
            return Answers.RETURNS_DEFAULTS.answer(invocation);
        });
        DemandService service = new DemandService(
                demandRepository,
                responseRepository,
                mock(ConversationService.class),
                mock(NotificationService.class),
                userRepository,
                packageRepository,
                mock(FileReferenceValidator.class));
        return new TestContext(service, candidateQueries, capabilityQueries, responseQueries);
    }

    private Demand demand(Long id,
                          Long customerId,
                          String city,
                          String scene,
                          List<String> styles,
                          Integer minBudget,
                          Integer maxBudget,
                          LocalDate expectedDate,
                          List<String> timeTags) {
        LocalDateTime createdAt = LocalDateTime.now().minusDays(2);
        Demand value = new Demand(
                customerId,
                scene,
                styles,
                expectedDate,
                "AFTERNOON",
                "Available",
                timeTags,
                city,
                city,
                minBudget,
                maxBudget,
                "Complete demand",
                List.of(1L),
                createdAt,
                LocalDateTime.now().plusDays(30));
        value.setId(id);
        value.setUpdatedAt(LocalDateTime.now().minusDays(20).plusMinutes(id));
        return value;
    }

    private ServicePackage capability(Long id,
                                      Long providerId,
                                      String city,
                                      String scene,
                                      List<String> styles,
                                      Long price,
                                      List<LocalDate> availableDates,
                                      List<String> timeTags) {
        ServicePackage value = new ServicePackage();
        value.setId(id);
        value.setProviderId(providerId);
        value.setTitle("Capability " + id);
        value.setCityCode(city);
        value.setServiceArea(city);
        value.setScene(scene);
        value.setStyleTags(styles);
        value.setImages(List.of("cover"));
        value.setBasePriceCent(price);
        value.setDurationMinutes(60);
        value.setOriginalCount(20);
        value.setRefinedCount(5);
        value.setDeliveryDays(7);
        value.setAvailableDates(availableDates);
        value.setPortfolioIds(List.of(1L));
        value.setDescription("Capability");
        value.setTimeDescription("Available");
        value.setTimeTags(timeTags);
        value.setStatus(ServicePackageStatus.ONLINE);
        value.setIsAvailable(true);
        value.setHiddenByProvider(false);
        value.setCreatedAt(LocalDateTime.now().minusDays(30));
        value.setUpdatedAt(LocalDateTime.now().minusDays(1));
        return value;
    }

    private User user(Long id) {
        User user = new User();
        user.setId(id);
        user.setNickname("Customer " + id);
        user.setCurrentRole("CUSTOMER");
        user.setStatus("ACTIVE");
        return user;
    }

    private CurrentUser provider(Long id) {
        return new CurrentUser(id, UserRole.PROVIDER);
    }

    private List<Long> ids(PageResult<DemandDto> result) {
        return result.getRecords().stream().map(DemandDto::getDemandId).toList();
    }

    private Collection<?> iterable(Iterable<?> values) {
        List<Object> result = new ArrayList<>();
        values.forEach(result::add);
        return result;
    }

    private record TestContext(DemandService service,
                               AtomicInteger candidateQueries,
                               AtomicInteger capabilityQueries,
                               AtomicInteger responseQueries) {
    }
}
