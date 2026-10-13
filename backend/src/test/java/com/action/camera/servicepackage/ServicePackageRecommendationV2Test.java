package com.action.camera.servicepackage;

import com.action.camera.application.FileReferenceValidator;
import com.action.camera.common.page.PageResult;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.common.security.UserRole;
import com.action.camera.credit.service.CreditSnapshotService;
import com.action.camera.demand.domain.Demand;
import com.action.camera.demand.repository.DemandRepository;
import com.action.camera.domain.User;
import com.action.camera.message.service.ConversationService;
import com.action.camera.provider.mapper.ProviderProfileMapper;
import com.action.camera.repository.UserRepository;
import com.action.camera.servicepackage.domain.ServicePackage;
import com.action.camera.servicepackage.domain.ServicePackageInterest;
import com.action.camera.servicepackage.domain.ServicePackageStatus;
import com.action.camera.servicepackage.dto.ServicePackageCardDto;
import com.action.camera.servicepackage.repository.ServicePackageInterestRepository;
import com.action.camera.servicepackage.repository.ServicePackageRepository;
import com.action.camera.servicepackage.service.ServicePackageService;
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
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class ServicePackageRecommendationV2Test {

    @Test
    void cityAndStyleProfilesProduceDifferentOrdersForDifferentCustomers() {
        List<ServicePackage> candidates = List.of(
                servicePackage(1L, 201L, "NJ", "PORTRAIT", List.of("natural"), 120_000L),
                servicePackage(2L, 202L, "NJ", "PORTRAIT", List.of("street"), 120_000L),
                servicePackage(3L, 203L, "SH", "EVENT", List.of("documentary"), 120_000L));

        Demand naturalNj = demand(11L, 901L, "NJ", "PORTRAIT", List.of("natural"), 100_000, 140_000);
        Demand documentarySh = demand(12L, 902L, "SH", "EVENT", List.of("documentary"), 100_000, 140_000);
        Demand streetNj = demand(13L, 903L, "NJ", "PORTRAIT", List.of("street"), 100_000, 140_000);

        assertThat(ids(context(candidates, List.of(naturalNj), List.of(), List.of()).service()
                .listServices(1, 10, null, null, null, null, null,
                        null, null, null, "recommend", null, customer(901L))))
                .startsWith(1L);
        assertThat(ids(context(candidates, List.of(documentarySh), List.of(), List.of()).service()
                .listServices(1, 10, null, null, null, null, null,
                        null, null, null, "recommend", null, customer(902L))))
                .startsWith(3L);
        assertThat(ids(context(candidates, List.of(streetNj), List.of(), List.of()).service()
                .listServices(1, 10, null, null, null, null, null,
                        null, null, null, "recommend", null, customer(903L))))
                .startsWith(2L);
    }

    @Test
    void recentDemandChangesColdStartOrderAndProviderRoleDoesNotReuseCustomerSignals() {
        ServicePackage matchingOlder = servicePackage(
                1L, 201L, "NJ", "PORTRAIT", List.of("natural"), 110_000L);
        ServicePackage latestUnrelated = servicePackage(
                2L, 202L, "SH", "EVENT", List.of("street"), 110_000L);
        List<ServicePackage> candidates = List.of(
                matchingOlder,
                latestUnrelated,
                servicePackage(3L, 203L, "BJ", "PRODUCT", List.of("commercial"), 110_000L),
                servicePackage(4L, 204L, "GZ", "WEDDING", List.of("classic"), 110_000L),
                servicePackage(5L, 205L, "SZ", "LANDSCAPE", List.of("travel"), 110_000L));
        Demand signal = demand(10L, 900L, "NJ", "PORTRAIT", List.of("natural"), 100_000, 120_000);
        TestContext personalized = context(candidates, List.of(signal), List.of(), List.of());

        List<Long> customerOrder = ids(personalized.service().listServices(
                1, 10, null, null, null, null, null,
                null, null, null, "recommend", null, customer(900L)));
        List<Long> providerRoleOrder = ids(personalized.service().listServices(
                1, 10, null, null, null, null, null,
                null, null, null, "recommend", null, new CurrentUser(900L, UserRole.PROVIDER)));
        List<Long> coldStartOrder = ids(context(candidates, List.of(), List.of(), List.of()).service()
                .listServices(1, 10, null, null, null, null, null,
                        null, null, null, "recommend", null, customer(999L)));

        assertThat(customerOrder).startsWith(1L);
        assertThat(providerRoleOrder).isEqualTo(coldStartOrder)
                .containsExactly(5L, 4L, 3L, 2L, 1L);
    }

    @Test
    void recentInterestDiscoversAnotherSimilarPackageWithoutCandidateQueries() {
        ServicePackage similar = servicePackage(
                1L, 201L, "NJ", "PORTRAIT", List.of("natural", "film"), 125_000L);
        ServicePackage unrelated = servicePackage(
                2L, 202L, "SH", "EVENT", List.of("street"), 130_000L);
        ServicePackage third = servicePackage(
                3L, 203L, "BJ", "PRODUCT", List.of("commercial"), 130_000L);
        ServicePackage fourth = servicePackage(
                4L, 204L, "GZ", "WEDDING", List.of("classic"), 130_000L);
        ServicePackage fifth = servicePackage(
                5L, 205L, "SZ", "LANDSCAPE", List.of("travel"), 130_000L);
        ServicePackage interestSource = servicePackage(
                99L, 299L, "NJ", "PORTRAIT", List.of("natural", "film"), 120_000L);
        ServicePackageInterest interest = new ServicePackageInterest();
        interest.setId(1L);
        interest.setUserId(900L);
        interest.setServicePackageId(99L);
        interest.setCreatedAt(LocalDateTime.now().minusDays(2));
        TestContext test = context(
                List.of(similar, unrelated, third, fourth, fifth),
                List.of(), List.of(interest), List.of(interestSource));

        PageResult<ServicePackageCardDto> result = test.service().listServices(
                1, 10, null, null, null, null, null,
                null, null, null, "recommend", "interest-seed", customer(900L));

        List<Long> v1TopFive = List.of(5L, 4L, 3L, 2L, 1L);
        assertThat(ids(result)).containsExactly(1L, 2L, 5L, 4L, 3L).isNotEqualTo(v1TopFive);
        assertThat(result.getRecords().get(0).getRecommendReasons())
                .contains("风格匹配", "城市偏好匹配")
                .doesNotContain("同城匹配");
        assertThat(test.candidateQueries()).hasValue(1);
        assertThat(test.demandSignalQueries()).hasValue(1);
        assertThat(test.interestSignalQueries()).hasValue(1);
        assertThat(test.interestPackageBatches()).hasValue(1);
    }

    @Test
    void priceAndTimeFitDistinguishCandidatesWithoutFalseTimeReason() {
        LocalDate desiredDate = LocalDate.now().plusDays(9);
        ServicePackage exact = servicePackage(
                1L, 201L, "SH", "OTHER", List.of("other"), 110_000L);
        exact.setAvailableDates(List.of(desiredDate));
        exact.setTimeTags(List.of("WEEKEND"));
        ServicePackage incompatible = servicePackage(
                2L, 202L, "SH", "OTHER", List.of("other"), 190_000L);
        incompatible.setAvailableDates(List.of(desiredDate.plusDays(10)));
        incompatible.setTimeTags(List.of("WEEKDAY"));
        Demand signal = demand(10L, 900L, "NJ", "PORTRAIT", List.of("natural"), 100_000, 120_000);
        signal.setExpectedDate(desiredDate);
        signal.setTimeTags(List.of("WEEKEND"));

        PageResult<ServicePackageCardDto> result = context(
                List.of(exact, incompatible), List.of(signal), List.of(), List.of()).service().listServices(
                1, 10, null, null, null, null, null,
                null, null, null, "recommend", null, customer(900L));

        assertThat(ids(result)).containsExactly(1L, 2L);
        assertThat(result.getRecords().get(0).getRecommendReasons()).contains("价格合适", "近期可约");
        assertThat(result.getRecords().get(1).getRecommendReasons()).doesNotContain("近期可约");
    }

    @Test
    void invalidPackagesAreExcludedAndReasonsRespectContractLimit() {
        ServicePackage visible = servicePackage(1L, 201L, "NJ", "PORTRAIT", List.of("natural"), 110_000L);
        ServicePackage hidden = servicePackage(2L, 202L, "NJ", "PORTRAIT", List.of("natural"), 110_000L);
        hidden.setHiddenByProvider(true);
        ServicePackage offline = servicePackage(3L, 203L, "NJ", "PORTRAIT", List.of("natural"), 110_000L);
        offline.setStatus(ServicePackageStatus.OFFLINE);
        ServicePackage unavailable = servicePackage(4L, 204L, "NJ", "PORTRAIT", List.of("natural"), 110_000L);
        unavailable.setIsAvailable(false);
        ServicePackage moderated = servicePackage(5L, 205L, "NJ", "PORTRAIT", List.of("natural"), 110_000L);
        moderated.takeDown(1L, "policy", LocalDateTime.now());
        Demand signal = demand(10L, 900L, "NJ", "PORTRAIT", List.of("natural"), 100_000, 120_000);

        PageResult<ServicePackageCardDto> result = context(
                List.of(visible, hidden, offline, unavailable, moderated),
                List.of(signal), List.of(), List.of()).service().listServices(
                1, 10, null, null, null, null, null,
                null, null, null, "recommend", null, customer(900L));

        assertThat(ids(result)).containsExactly(1L);
        assertThat(result.getRecords().get(0).getRecommendReasons()).hasSizeLessThanOrEqualTo(3);
    }

    @Test
    void globalOrderingPaginationAndSeedStayStableWithoutDuplicateOrOmission() {
        List<ServicePackage> candidates = new ArrayList<>();
        for (long id = 1; id <= 12; id++) {
            candidates.add(servicePackage(
                    id, 200L + id, "C" + id, "SCENE" + id, List.of("style" + id), 100_000L + id));
        }
        ServicePackageService service = context(candidates, List.of(), List.of(), List.of()).service();

        List<Long> page1 = ids(service.listServices(
                1, 5, null, null, null, null, null,
                null, null, null, "recommend", "stable-seed", null));
        List<Long> page2 = ids(service.listServices(
                2, 5, null, null, null, null, null,
                null, null, null, "recommend", "stable-seed", null));
        List<Long> page3 = ids(service.listServices(
                3, 5, null, null, null, null, null,
                null, null, null, "recommend", "stable-seed", null));
        List<Long> combined = new ArrayList<>(page1);
        combined.addAll(page2);
        combined.addAll(page3);

        assertThat(combined).hasSize(12).doesNotHaveDuplicates();
        assertThat(combined).containsExactlyElementsOf(ids(service.listServices(
                1, 12, null, null, null, null, null,
                null, null, null, "recommend", "stable-seed", null)));
    }

    @Test
    void deterministicFixtureDocumentsMeaningfulV1ToV2TopFiveChange() {
        List<ServicePackage> candidates = List.of(
                servicePackage(5L, 205L, "HZ", "EVENT", List.of("street"), 300_000L),
                servicePackage(4L, 204L, "SZ", "PRODUCT", List.of("commercial"), 260_000L),
                servicePackage(3L, 203L, "SH", "PORTRAIT", List.of("fashion"), 180_000L),
                servicePackage(2L, 202L, "NJ", "PORTRAIT", List.of("natural"), 135_000L),
                servicePackage(1L, 201L, "NJ", "PORTRAIT", List.of("natural", "film"), 110_000L));
        Demand signal = demand(10L, 900L, "NJ", "PORTRAIT", List.of("natural", "film"), 100_000, 120_000);

        List<Long> v1TopFive = List.of(2L, 1L, 5L, 4L, 3L);
        List<Long> v2TopFive = ids(context(candidates, List.of(signal), List.of(), List.of()).service()
                .listServices(1, 5, null, null, null, null, null,
                        null, null, null, "recommend", null, customer(900L)));

        assertThat(v2TopFive).containsExactly(1L, 2L, 3L, 5L, 4L).isNotEqualTo(v1TopFive);
    }

    private TestContext context(List<ServicePackage> candidates,
                                List<Demand> demands,
                                List<ServicePackageInterest> interests,
                                List<ServicePackage> signalPackages) {
        AtomicInteger candidateQueries = new AtomicInteger();
        AtomicInteger demandSignalQueries = new AtomicInteger();
        AtomicInteger interestSignalQueries = new AtomicInteger();
        AtomicInteger interestPackageBatches = new AtomicInteger();
        Map<Long, ServicePackage> packagesById = new LinkedHashMap<>();
        candidates.forEach(value -> packagesById.put(value.getId(), value));
        signalPackages.forEach(value -> packagesById.put(value.getId(), value));

        ServicePackageRepository packageRepository = mock(ServicePackageRepository.class, invocation -> {
            if (invocation.getMethod().getName().equals("findPublicPage")) {
                candidateQueries.incrementAndGet();
                return new PageImpl<>(candidates);
            }
            if (invocation.getMethod().getName().equals("findAllById")) {
                interestPackageBatches.incrementAndGet();
                Collection<?> ids = iterable(invocation.getArgument(0));
                return ids.stream().map(id -> packagesById.get((Long) id)).filter(java.util.Objects::nonNull).toList();
            }
            return Answers.RETURNS_DEFAULTS.answer(invocation);
        });
        DemandRepository demandRepository = mock(DemandRepository.class, invocation -> {
            if (invocation.getMethod().getName().equals("findActiveRecommendationSignals")) {
                demandSignalQueries.incrementAndGet();
                Long customerId = invocation.getArgument(0);
                return demands.stream().filter(value -> customerId.equals(value.getCustomerId())).toList();
            }
            return Answers.RETURNS_DEFAULTS.answer(invocation);
        });
        ServicePackageInterestRepository interestRepository = mock(ServicePackageInterestRepository.class, invocation -> {
            if (invocation.getMethod().getName().equals(
                    "findByUserIdAndCreatedAtGreaterThanEqualOrderByCreatedAtDesc")) {
                interestSignalQueries.incrementAndGet();
                Long customerId = invocation.getArgument(0);
                return interests.stream().filter(value -> customerId.equals(value.getUserId())).toList();
            }
            return Answers.RETURNS_DEFAULTS.answer(invocation);
        });
        Map<Long, User> users = new LinkedHashMap<>();
        for (ServicePackage candidate : candidates) {
            users.put(candidate.getProviderId(), user(candidate.getProviderId(), null));
        }
        demands.forEach(value -> users.putIfAbsent(value.getCustomerId(), user(value.getCustomerId(), null)));
        UserRepository userRepository = mock(UserRepository.class, invocation -> {
            if (invocation.getMethod().getName().equals("findAllById")) {
                Collection<?> ids = iterable(invocation.getArgument(0));
                return ids.stream().map(id -> users.get((Long) id)).filter(java.util.Objects::nonNull).toList();
            }
            if (invocation.getMethod().getName().equals("findById")) {
                return Optional.ofNullable(users.get(invocation.getArgument(0)));
            }
            return Answers.RETURNS_DEFAULTS.answer(invocation);
        });
        ProviderProfileMapper profiles = mock(ProviderProfileMapper.class, invocation -> {
            if (invocation.getMethod().getName().equals("selectList")) {
                return List.of();
            }
            return Answers.RETURNS_DEFAULTS.answer(invocation);
        });
        CreditSnapshotService credits = mock(CreditSnapshotService.class, invocation -> {
            if (invocation.getMethod().getName().equals("getDisplayCreditScores")) {
                return Map.of();
            }
            return Answers.RETURNS_DEFAULTS.answer(invocation);
        });
        ServicePackageService service = new ServicePackageService(
                packageRepository,
                interestRepository,
                demandRepository,
                mock(ConversationService.class),
                userRepository,
                profiles,
                credits,
                mock(FileReferenceValidator.class));
        return new TestContext(service, candidateQueries, demandSignalQueries,
                interestSignalQueries, interestPackageBatches);
    }

    private ServicePackage servicePackage(Long id,
                                          Long providerId,
                                          String city,
                                          String scene,
                                          List<String> styles,
                                          Long price) {
        ServicePackage value = new ServicePackage();
        value.setId(id);
        value.setProviderId(providerId);
        value.setTitle("Package " + id);
        value.setCityCode(city);
        value.setServiceArea(city);
        value.setScene(scene);
        value.setStyleTags(styles);
        value.setImages(List.of("cover-" + id));
        value.setBasePriceCent(price);
        value.setPriceRange(String.valueOf(price));
        value.setDurationMinutes(60);
        value.setOriginalCount(20);
        value.setRefinedCount(5);
        value.setDeliveryDays(7);
        value.setAvailableDates(List.of());
        value.setPortfolioIds(List.of(1L));
        value.setDescription("Complete package");
        value.setTimeDescription("By appointment");
        value.setTimeTags(List.of());
        value.setStatus(ServicePackageStatus.ONLINE);
        value.setIsAvailable(true);
        value.setHiddenByProvider(false);
        LocalDateTime timestamp = LocalDateTime.now().minusDays(40);
        value.setCreatedAt(timestamp);
        value.setUpdatedAt(timestamp.plusMinutes(id));
        return value;
    }

    private Demand demand(Long id,
                          Long customerId,
                          String city,
                          String scene,
                          List<String> styles,
                          Integer minBudget,
                          Integer maxBudget) {
        LocalDateTime createdAt = LocalDateTime.now().minusDays(2);
        Demand value = new Demand(
                customerId,
                scene,
                styles,
                LocalDate.now().plusDays(7),
                "AFTERNOON",
                "Available",
                List.of(),
                city,
                city,
                minBudget,
                maxBudget,
                "Demand",
                List.of(),
                createdAt,
                LocalDateTime.now().plusDays(30));
        value.setId(id);
        return value;
    }

    private User user(Long id, String city) {
        User user = new User();
        user.setId(id);
        user.setNickname("User " + id);
        user.setCityCode(city);
        user.setCurrentRole("CUSTOMER");
        user.setStatus("ACTIVE");
        return user;
    }

    private CurrentUser customer(Long id) {
        return new CurrentUser(id, UserRole.CUSTOMER);
    }

    private List<Long> ids(PageResult<ServicePackageCardDto> result) {
        return result.getRecords().stream().map(ServicePackageCardDto::getServiceId).toList();
    }

    private Collection<?> iterable(Iterable<?> values) {
        List<Object> result = new ArrayList<>();
        values.forEach(result::add);
        return result;
    }

    private record TestContext(ServicePackageService service,
                               AtomicInteger candidateQueries,
                               AtomicInteger demandSignalQueries,
                               AtomicInteger interestSignalQueries,
                               AtomicInteger interestPackageBatches) {
    }
}
