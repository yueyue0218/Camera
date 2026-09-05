package com.action.camera.servicepackage;

import com.action.camera.common.page.PageResult;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.common.security.UserRole;
import com.action.camera.credit.service.CreditSnapshotService;
import com.action.camera.domain.User;
import com.action.camera.message.service.ConversationService;
import com.action.camera.provider.entity.ProviderProfile;
import com.action.camera.provider.mapper.ProviderProfileMapper;
import com.action.camera.repository.UserRepository;
import com.action.camera.servicepackage.domain.ServicePackage;
import com.action.camera.servicepackage.domain.ServicePackageStatus;
import com.action.camera.servicepackage.dto.ServicePackageCardDto;
import com.action.camera.servicepackage.repository.ServicePackageInterestRepository;
import com.action.camera.servicepackage.repository.ServicePackageRepository;
import com.action.camera.servicepackage.service.ServicePackageService;
import org.junit.jupiter.api.Test;
import org.mockito.Answers;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
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

class ServicePackageA2BehaviorTest {

    @Test
    void ordinarySortUsesDatabasePageAndDatabaseTotalInsteadOfLegacyFullScan() {
        ServicePackage selected = servicePackage(12L, 202L, "NJ", "natural", LocalDate.now().plusDays(3));
        ServicePackageRepository repository = mock(ServicePackageRepository.class, invocation -> {
            if (invocation.getMethod().getName().equals("findByStatus")) {
                throw new AssertionError("普通排序路径不得加载全部 ONLINE 服务包");
            }
            if (invocation.getMethod().getName().equals("findPublicPage")) {
                return new PageImpl<>(List.of(selected), PageRequest.of(1, 2), 7);
            }
            return Answers.RETURNS_DEFAULTS.answer(invocation);
        });
        User provider = user(202L, "Provider 202", "SH");
        ServicePackageService service = service(
                repository,
                mock(ServicePackageInterestRepository.class),
                users(Map.of(202L, provider), false),
                profiles(List.of(), false),
                credits(Map.of(202L, new BigDecimal("81.0")), false)
        );

        PageResult<ServicePackageCardDto> result = service.listServices(
                2, 2, "NJ", "PORTRAIT", "natural",
                30000L, 90000L, LocalDate.now().plusDays(3),
                "NEAR_7_DAYS", "portrait", "latest", null, null);

        assertThat(result.getPage()).isEqualTo(2);
        assertThat(result.getSize()).isEqualTo(2);
        assertThat(result.getTotal()).isEqualTo(7);
        assertThat(result.getRecords()).extracting(ServicePackageCardDto::getServiceId)
                .containsExactly(12L);
    }

    @Test
    void recommendationMetadataUsesOneBatchPerSourceAndKeepsMissingProfileFallback() {
        ServicePackage first = servicePackage(2L, 202L, "NJ", "natural", LocalDate.now().plusDays(3));
        ServicePackage second = servicePackage(1L, 201L, "SH", "street", LocalDate.now().plusDays(5));
        ServicePackageRepository repository = recommendationRepository(List.of(first, second));
        User provider201 = user(201L, "User 201", "SH");
        User provider202 = user(202L, "User 202", "NJ");
        ProviderProfile profile202 = profile(202L, "Profile 202");
        ServicePackageService service = service(
                repository,
                mock(ServicePackageInterestRepository.class),
                users(Map.of(201L, provider201, 202L, provider202), true),
                profiles(List.of(profile202), true),
                credits(Map.of(201L, new BigDecimal("72.0"), 202L, new BigDecimal("91.0")), true)
        );

        PageResult<ServicePackageCardDto> result = service.listServices(
                1, 10, null, null, null, null, null,
                null, null, null, "recommend", null, null);

        assertThat(result.getRecords()).extracting(ServicePackageCardDto::getPhotographerNickname)
                .containsExactly("Profile 202", "User 201");
        assertThat(result.getRecords()).extracting(ServicePackageCardDto::getCreditScore)
                .containsExactly(new BigDecimal("91.0"), new BigDecimal("72.0"));
    }

    @Test
    void recommendationKeepsCityInterestCreditAndDateFactorsAndFeedSeedIsStable() {
        LocalDate nearDate = LocalDate.now().plusDays(2);
        ServicePackage city = servicePackage(101L, 201L, "NJ", "city", LocalDate.now().minusDays(30));
        ServicePackage credit = servicePackage(102L, 202L, "SH", "credit", LocalDate.now().minusDays(30));
        ServicePackage interested = servicePackage(103L, 203L, "SH", "interest", LocalDate.now().minusDays(30));
        ServicePackage dated = servicePackage(100L, 204L, "SH", "date", nearDate);
        List<ServicePackage> packages = List.of(city, credit, interested, dated);
        Map<Long, User> users = Map.of(
                900L, user(900L, "Customer", "NJ"),
                201L, user(201L, "P201", "NJ"),
                202L, user(202L, "P202", "SH"),
                203L, user(203L, "P203", "SH"),
                204L, user(204L, "P204", "SH")
        );
        Map<Long, BigDecimal> scores = Map.of(
                201L, new BigDecimal("60.0"),
                202L, new BigDecimal("90.0"),
                203L, new BigDecimal("60.0"),
                204L, new BigDecimal("60.0")
        );
        ServicePackageInterestRepository interests = mock(ServicePackageInterestRepository.class, invocation -> {
            if (invocation.getMethod().getName().equals("findByUserIdOrderByCreatedAtDesc")) {
                var interest = new com.action.camera.servicepackage.domain.ServicePackageInterest();
                interest.setUserId(900L);
                interest.setServicePackageId(103L);
                return List.of(interest);
            }
            return Answers.RETURNS_DEFAULTS.answer(invocation);
        });
        ServicePackageService service = service(
                recommendationRepository(packages), interests, users(users, false), profiles(List.of(), false), credits(scores, false));
        CurrentUser customer = new CurrentUser(900L, UserRole.CUSTOMER);

        PageResult<ServicePackageCardDto> result = service.listServices(
                1, 10, null, null, null, null, null,
                null, null, null, "recommend", null, customer);
        List<Long> firstSeed = ids(service.listServices(
                1, 10, null, null, null, null, null,
                null, null, null, "recommend", "stable-seed", customer));
        List<Long> secondSeed = ids(service.listServices(
                1, 10, null, null, null, null, null,
                null, null, null, "recommend", "stable-seed", customer));

        assertThat(ids(result)).containsExactly(101L, 102L, 103L, 100L);
        assertThat(result.getRecords().get(0).getRecommendReasons()).contains("同城匹配");
        assertThat(result.getRecords().get(1).getRecommendReasons()).contains("信用较高");
        assertThat(result.getRecords().get(3).getRecommendReasons()).contains("近期可约");
        assertThat(firstSeed).isEqualTo(secondSeed);
    }

    @Test
    void recommendationKeepsSequentialDiversificationAcrossPages() {
        List<ServicePackage> packages = List.of(
                servicePackage(6L, 201L, "A", "a", LocalDate.now().minusDays(60)),
                servicePackage(5L, 201L, "A", "a", LocalDate.now().minusDays(60)),
                servicePackage(4L, 201L, "A", "a", LocalDate.now().minusDays(60)),
                servicePackage(3L, 202L, "B", "b", LocalDate.now().minusDays(60)),
                servicePackage(2L, 203L, "C", "c", LocalDate.now().minusDays(60)),
                servicePackage(1L, 204L, "D", "d", LocalDate.now().minusDays(60))
        );
        Map<Long, User> users = Map.of(
                201L, user(201L, "P201", "A"),
                202L, user(202L, "P202", "B"),
                203L, user(203L, "P203", "C"),
                204L, user(204L, "P204", "D")
        );
        Map<Long, BigDecimal> scores = Map.of(
                201L, new BigDecimal("60.0"), 202L, new BigDecimal("60.0"),
                203L, new BigDecimal("60.0"), 204L, new BigDecimal("60.0")
        );
        ServicePackageService service = service(
                recommendationRepository(packages), mock(ServicePackageInterestRepository.class),
                users(users, false), profiles(List.of(), false), credits(scores, false));

        PageResult<ServicePackageCardDto> page1 = service.listServices(
                1, 3, null, null, null, null, null,
                null, null, null, "recommend", null, null);
        PageResult<ServicePackageCardDto> page2 = service.listServices(
                2, 3, null, null, null, null, null,
                null, null, null, "recommend", null, null);

        assertThat(ids(page1)).containsExactly(6L, 5L, 3L);
        assertThat(ids(page2)).containsExactly(4L, 2L, 1L);
        assertThat(page1.getTotal()).isEqualTo(6);
        assertThat(page2.getTotal()).isEqualTo(6);
    }

    @Test
    void recommendationKeepsA1ObjectsHashOrderAcrossPagesAndDtoContent() {
        List<ServicePackage> packages = new ArrayList<>();
        Map<Long, User> userValues = new LinkedHashMap<>();
        Map<Long, BigDecimal> scoreValues = new LinkedHashMap<>();
        LocalDateTime sameTimestamp = LocalDateTime.of(2026, 1, 1, 10, 0);
        for (long id = 1; id <= 12; id++) {
            long providerId = 300L + id;
            ServicePackage servicePackage = servicePackage(id, providerId, "C" + id, "s" + id, null);
            servicePackage.setCreatedAt(sameTimestamp);
            servicePackage.setUpdatedAt(sameTimestamp);
            packages.add(servicePackage);
            userValues.put(providerId, user(providerId, "P" + id, "C" + id));
            scoreValues.put(providerId, new BigDecimal("80.0"));
        }
        ServicePackageService service = service(
                recommendationRepository(packages), mock(ServicePackageInterestRepository.class),
                users(userValues, false), profiles(List.of(), false), credits(scoreValues, false));

        PageResult<ServicePackageCardDto> page1 = service.listServices(
                1, 6, null, null, null, null, null,
                null, null, null, "recommend", "semantic-seed", null);
        PageResult<ServicePackageCardDto> page2 = service.listServices(
                2, 6, null, null, null, null, null,
                null, null, null, "recommend", "semantic-seed", null);
        List<Long> fullOrder = new ArrayList<>(ids(page1));
        fullOrder.addAll(ids(page2));

        assertThat(fullOrder).containsExactly(12L, 1L, 11L, 10L, 9L, 8L, 7L, 6L, 5L, 4L, 3L, 2L);
        assertThat(ids(service.listServices(
                1, 12, null, null, null, null, null,
                null, null, null, "recommend", "semantic-seed", null)))
                .containsExactlyElementsOf(fullOrder);
        assertThat(page1.getTotal()).isEqualTo(12);
        assertThat(page2.getTotal()).isEqualTo(12);

        ServicePackageCardDto first = page1.getRecords().get(0);
        assertThat(first.getServiceId()).isEqualTo(12L);
        assertThat(first.getProviderId()).isEqualTo(312L);
        assertThat(first.getPhotographerId()).isEqualTo(312L);
        assertThat(first.getPhotographerNickname()).isEqualTo("P12");
        assertThat(first.getCreditScore()).isEqualByComparingTo("80.0");
        assertThat(first.getTitle()).isEqualTo("Portrait 12");
        assertThat(first.getCityCode()).isEqualTo("C12");
        assertThat(first.getScene()).isEqualTo("PORTRAIT");
        assertThat(first.getStyleTags()).containsExactly("s12");
        assertThat(first.getImages()).containsExactly("cover-12");
        assertThat(first.getBasePriceCent()).isEqualTo(200000L);
        assertThat(first.getStatus()).isEqualTo("ONLINE");
        assertThat(first.getAvailableDates()).isEmpty();
        assertThat(first.getTimeTags()).containsExactly("NEAR_7_DAYS");
        assertThat(first.getRecommendReasons()).containsExactly("信用较高", "作品完整");
    }

    @Test
    void recommendationMetadataQuerySourcesStayConstantForTwentySevenPhotographers() {
        List<ServicePackage> packages = new ArrayList<>();
        Map<Long, User> userValues = new LinkedHashMap<>();
        Map<Long, BigDecimal> scoreValues = new LinkedHashMap<>();
        for (long index = 1; index <= 27; index++) {
            long providerId = 200L + index;
            packages.add(servicePackage(index, providerId, "NJ", "style-" + index, null));
            userValues.put(providerId, user(providerId, "P" + index, "NJ"));
            scoreValues.put(providerId, new BigDecimal("80.0"));
        }
        AtomicInteger userBatchCalls = new AtomicInteger();
        AtomicInteger profileBatchCalls = new AtomicInteger();
        AtomicInteger creditBatchCalls = new AtomicInteger();
        UserRepository users = mock(UserRepository.class, invocation -> {
            if (invocation.getMethod().getName().equals("findAllById")) {
                userBatchCalls.incrementAndGet();
                return new ArrayList<>(userValues.values());
            }
            return Answers.RETURNS_DEFAULTS.answer(invocation);
        });
        ProviderProfileMapper profiles = mock(ProviderProfileMapper.class, invocation -> {
            if (invocation.getMethod().getName().equals("selectList")) {
                profileBatchCalls.incrementAndGet();
                return List.of();
            }
            return Answers.RETURNS_DEFAULTS.answer(invocation);
        });
        CreditSnapshotService credits = mock(CreditSnapshotService.class, invocation -> {
            if (invocation.getMethod().getName().equals("getDisplayCreditScores")) {
                creditBatchCalls.incrementAndGet();
                return scoreValues;
            }
            return Answers.RETURNS_DEFAULTS.answer(invocation);
        });
        ServicePackageService service = service(
                recommendationRepository(packages), mock(ServicePackageInterestRepository.class),
                users, profiles, credits);

        PageResult<ServicePackageCardDto> result = service.listServices(
                1, 10, null, null, null, null, null,
                null, null, null, "recommend", "stable-seed", null);

        assertThat(result.getTotal()).isEqualTo(27);
        assertThat(userBatchCalls).hasValue(1);
        assertThat(profileBatchCalls).hasValue(1);
        assertThat(creditBatchCalls).hasValue(1);
    }

    private ServicePackageService service(ServicePackageRepository repository,
                                          ServicePackageInterestRepository interests,
                                          UserRepository users,
                                          ProviderProfileMapper profiles,
                                          CreditSnapshotService credits) {
        return new ServicePackageService(
                repository, interests, mock(ConversationService.class), users, profiles, credits);
    }

    private ServicePackageRepository recommendationRepository(List<ServicePackage> packages) {
        return mock(ServicePackageRepository.class, invocation -> {
            if (invocation.getMethod().getName().equals("findByStatus")) {
                return packages;
            }
            return Answers.RETURNS_DEFAULTS.answer(invocation);
        });
    }

    private UserRepository users(Map<Long, User> values, boolean rejectSingleMetadataLookup) {
        return mock(UserRepository.class, invocation -> {
            if (invocation.getMethod().getName().equals("findAllById")) {
                Collection<?> requested = iterable(invocation.getArgument(0));
                return requested.stream().map(id -> values.get((Long) id)).filter(java.util.Objects::nonNull).toList();
            }
            if (invocation.getMethod().getName().equals("findById")) {
                Long id = invocation.getArgument(0);
                if (rejectSingleMetadataLookup && id < 900L) {
                    throw new AssertionError("metadata 不得循环调用 UserRepository.findById");
                }
                return Optional.ofNullable(values.get(id));
            }
            return Answers.RETURNS_DEFAULTS.answer(invocation);
        });
    }

    private ProviderProfileMapper profiles(List<ProviderProfile> values, boolean rejectSingleLookup) {
        return mock(ProviderProfileMapper.class, invocation -> {
            if (invocation.getMethod().getName().equals("selectList")) {
                return values;
            }
            if (invocation.getMethod().getName().equals("selectOne")) {
                if (rejectSingleLookup) {
                    throw new AssertionError("metadata 不得循环调用 ProviderProfileMapper.selectOne");
                }
                Object wrapper = invocation.getArgument(0);
                return values.stream().findFirst().orElse(null);
            }
            return Answers.RETURNS_DEFAULTS.answer(invocation);
        });
    }

    private CreditSnapshotService credits(Map<Long, BigDecimal> values, boolean rejectSingleLookup) {
        return mock(CreditSnapshotService.class, invocation -> {
            if (invocation.getMethod().getName().equals("getDisplayCreditScores")) {
                return new LinkedHashMap<>(values);
            }
            if (invocation.getMethod().getName().equals("getDisplayCreditScore")) {
                Long id = invocation.getArgument(0);
                if (rejectSingleLookup) {
                    throw new AssertionError("metadata 不得循环调用 CreditSnapshotService.getDisplayCreditScore");
                }
                return values.get(id);
            }
            return Answers.RETURNS_DEFAULTS.answer(invocation);
        });
    }

    private Collection<?> iterable(Iterable<?> values) {
        List<Object> result = new ArrayList<>();
        values.forEach(result::add);
        return result;
    }

    private ServicePackage servicePackage(Long id,
                                          Long providerId,
                                          String city,
                                          String style,
                                          LocalDate availableDate) {
        ServicePackage servicePackage = new ServicePackage();
        servicePackage.setId(id);
        servicePackage.setProviderId(providerId);
        servicePackage.setTitle("Portrait " + id);
        servicePackage.setCityCode(city);
        servicePackage.setServiceArea("Campus");
        servicePackage.setScene("PORTRAIT");
        servicePackage.setStyleTags(List.of(style));
        servicePackage.setImages(List.of("cover-" + id));
        servicePackage.setBasePriceCent(200000L);
        servicePackage.setPriceRange("2000");
        servicePackage.setDurationMinutes(60);
        servicePackage.setOriginalCount(20);
        servicePackage.setRefinedCount(5);
        servicePackage.setDeliveryDays(7);
        servicePackage.setAvailableDates(availableDate == null ? List.of() : List.of(availableDate));
        servicePackage.setPortfolioIds(List.of());
        servicePackage.setDescription("Complete portrait package");
        servicePackage.setTimeDescription("Weekends");
        servicePackage.setTimeTags(List.of("NEAR_7_DAYS"));
        servicePackage.setStatus(ServicePackageStatus.ONLINE);
        servicePackage.setIsAvailable(true);
        servicePackage.setHiddenByProvider(false);
        LocalDateTime updated = LocalDateTime.of(2026, 1, 1, 10, 0).plusMinutes(id);
        servicePackage.setCreatedAt(updated.minusDays(1));
        servicePackage.setUpdatedAt(updated);
        return servicePackage;
    }

    private User user(Long id, String nickname, String city) {
        User user = new User();
        user.setId(id);
        user.setNickname(nickname);
        user.setCityCode(city);
        user.setCurrentRole("PROVIDER");
        user.setStatus("ACTIVE");
        return user;
    }

    private ProviderProfile profile(Long userId, String displayName) {
        ProviderProfile profile = new ProviderProfile();
        profile.setId(userId + 1000);
        profile.setUserId(userId);
        profile.setDisplayName(displayName);
        return profile;
    }

    private List<Long> ids(PageResult<ServicePackageCardDto> page) {
        return page.getRecords().stream().map(ServicePackageCardDto::getServiceId).toList();
    }
}
