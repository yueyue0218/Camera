package com.action.camera.servicepackage.service;

import com.action.camera.admin.dto.ModerationView;
import com.action.camera.application.FileReferenceValidator;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.region.ProvinceNames;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.page.PageResult;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.credit.service.CreditSnapshotService;
import com.action.camera.demand.domain.Demand;
import com.action.camera.demand.domain.DemandStatus;
import com.action.camera.demand.repository.DemandRepository;
import com.action.camera.domain.User;
import com.action.camera.message.model.CreateConversationCommand;
import com.action.camera.message.model.CreateConversationResult;
import com.action.camera.message.service.ConversationService;
import com.action.camera.provider.entity.ProviderProfile;
import com.action.camera.provider.mapper.ProviderProfileMapper;
import com.action.camera.recommendation.RecommendationMatcher;
import com.action.camera.recommendation.RecommendationMatcher.WeightedBudget;
import com.action.camera.servicepackage.domain.ServicePackage;
import com.action.camera.servicepackage.domain.ServicePackageInterest;
import com.action.camera.servicepackage.domain.ServicePackageStatus;
import com.action.camera.servicepackage.dto.CreateServicePackageRequest;
import com.action.camera.servicepackage.dto.CreateServicePackageResult;
import com.action.camera.servicepackage.dto.ReserveServicePackageRequest;
import com.action.camera.servicepackage.dto.ReserveServicePackageResult;
import com.action.camera.servicepackage.dto.ServicePackageInterestDto;
import com.action.camera.servicepackage.dto.ServicePackageCardDto;
import com.action.camera.servicepackage.dto.ServicePackageDetailDto;
import com.action.camera.servicepackage.dto.StartServicePackageChatRequest;
import com.action.camera.servicepackage.dto.StartServicePackageChatResult;
import com.action.camera.servicepackage.dto.UpdateServicePackageRequest;
import com.action.camera.servicepackage.mapper.PhotographerInfo;
import com.action.camera.servicepackage.mapper.ServicePackageMapper;
import com.action.camera.servicepackage.repository.ServicePackageInterestRepository;
import com.action.camera.servicepackage.repository.ServicePackageRepository;
import com.action.camera.repository.UserRepository;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Comparator;
import java.util.Map;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ServicePackageService {

    private static final Logger LOGGER = LoggerFactory.getLogger(ServicePackageService.class);
    private static final int MAX_PAGE_SIZE = 50;
    private static final int MAX_IMAGE_COUNT = 9;
    private static final int MAX_CUSTOMER_DEMAND_SIGNALS = 12;
    private static final int MAX_CUSTOMER_INTEREST_SIGNALS = 20;
    private static final int CUSTOMER_INTEREST_LOOKBACK_DAYS = 180;
    private static final int CUSTOMER_PROFILE_FULL_CONFIDENCE_WEIGHT = 60;
    private static final String DEFAULT_RESERVE_MESSAGE = "I would like to reserve this service package.";
    private static final Set<String> SUPPORTED_TIME_TAGS = Set.of(
            "NEAR_3_DAYS",
            "NEAR_7_DAYS",
            "NEAR_1_MONTH"
    );

    private final ServicePackageRepository servicePackageRepository;
    private final ServicePackageInterestRepository interestRepository;
    private final DemandRepository demandRepository;
    private final ConversationService conversationService;
    private final UserRepository userRepository;
    private final ProviderProfileMapper providerProfileMapper;
    private final CreditSnapshotService creditSnapshotService;
    private final FileReferenceValidator fileReferenceValidator;

    @Value("${service-package.performance-probe.enabled:false}")
    private boolean servicePackagePerformanceProbeEnabled;

    public ServicePackageService(ServicePackageRepository servicePackageRepository,
                                  ServicePackageInterestRepository interestRepository,
                                  DemandRepository demandRepository,
                                  ConversationService conversationService,
                                  UserRepository userRepository,
                                  ProviderProfileMapper providerProfileMapper,
                                  CreditSnapshotService creditSnapshotService,
                                  FileReferenceValidator fileReferenceValidator) {
        this.servicePackageRepository = servicePackageRepository;
        this.interestRepository = interestRepository;
        this.demandRepository = demandRepository;
        this.conversationService = conversationService;
        this.userRepository = userRepository;
        this.providerProfileMapper = providerProfileMapper;
        this.creditSnapshotService = creditSnapshotService;
        this.fileReferenceValidator = fileReferenceValidator;
    }

    @Transactional
    public CreateServicePackageResult createServicePackage(CurrentUser currentUser,
                                                           CreateServicePackageRequest request) {
        ensureProvider(currentUser);
        validateCreateRequest(request);

        ServicePackage servicePackage = new ServicePackage();
        servicePackage.setProviderId(currentUser.getUserId());
        servicePackage.setTitle(trim(request.getTitle()));
        servicePackage.setCityCode(ProvinceNames.requireCode(request.getCityCode()));
        servicePackage.setServiceArea(trimToNull(request.getServiceArea()));
        servicePackage.setScene(trim(request.getScene()));
        servicePackage.setStyleTags(normalizeTags(request.getStyleTags()));
        servicePackage.setImages(normalizeStrings(request.getImages(), false));
        servicePackage.setBasePriceCent(request.getBasePriceCent());
        servicePackage.setPriceRange(trimToNull(request.getPriceRange()));
        servicePackage.setDurationMinutes(request.getDurationMinutes());
        servicePackage.setOriginalCount(request.getOriginalCount());
        servicePackage.setRefinedCount(request.getRefinedCount());
        servicePackage.setDeliveryDays(request.getDeliveryDays());
        servicePackage.setAvailableDates(normalizeDates(request.getAvailableDates()));
        List<Long> portfolioIds = normalizeIds(request.getPortfolioIds());
        ensureMaxImageCount(portfolioIds);
        fileReferenceValidator.requireExisting(portfolioIds, "portfolioIds");
        servicePackage.setPortfolioIds(portfolioIds);
        servicePackage.setDescription(trimToNull(request.getDescription()));
        servicePackage.setTimeDescription(trim(request.getTimeDescription()));
        servicePackage.setTimeTags(normalizeTimeTags(request.getTimeTags()));
        servicePackage.setStatus(ServicePackageStatus.ONLINE);
        servicePackage.setIsAvailable(true);

        return ServicePackageMapper.toCreateResult(servicePackageRepository.save(servicePackage));
    }

    @Transactional(readOnly = true)
    public PageResult<ServicePackageCardDto> listServices(int page,
                                                          int size,
                                                          String cityCode,
                                                          String scene,
                                                          String style,
                                                          Long minPriceCent,
                                                          Long maxPriceCent,
                                                          LocalDate availableDate,
                                                          String sort) {
        return listServices(page, size, cityCode, scene, style, minPriceCent, maxPriceCent,
                availableDate, null, sort);
    }

    @Transactional(readOnly = true)
    public PageResult<ServicePackageCardDto> listServices(int page,
                                                          int size,
                                                          String cityCode,
                                                          String scene,
                                                          String style,
                                                          Long minPriceCent,
                                                          Long maxPriceCent,
                                                          LocalDate availableDate,
                                                          String timeTag,
                                                          String sort) {
        return listServices(page, size, cityCode, scene, style, minPriceCent, maxPriceCent,
                availableDate, timeTag, null, sort, null, null);
    }

    @Transactional(readOnly = true)
    public PageResult<ServicePackageCardDto> listServices(int page,
                                                          int size,
                                                          String cityCode,
                                                          String scene,
                                                          String style,
                                                          Long minPriceCent,
                                                          Long maxPriceCent,
                                                          LocalDate availableDate,
                                                          String timeTag,
                                                          String keyword,
                                                          String sort,
                                                          String feedSeed,
                                                          CurrentUser currentUser) {
        int safePage = Math.max(page, 1);
        int safeSize = Math.max(1, Math.min(size, MAX_PAGE_SIZE));
        String normalizedCity = ProvinceNames.query(cityCode);
        String normalizedScene = normalizeFilter(scene);
        String normalizedStyle = normalizeFilter(style);
        String normalizedTimeTag = normalizeTimeTagFilter(timeTag);
        String normalizedSort = normalizeServiceSort(sort);

        if (!"recommend".equals(normalizedSort)) {
            return listOrdinaryServices(
                    safePage, safeSize, normalizedCity, normalizedScene, normalizedStyle,
                    minPriceCent, maxPriceCent, availableDate, normalizedTimeTag,
                    keyword, normalizedSort);
        }

        List<ServicePackage> packages = servicePackageRepository.findPublicPage(
                normalizedCity,
                normalizedScene,
                normalizedStyle,
                minPriceCent,
                maxPriceCent,
                availableDate == null ? null : availableDate.toString(),
                normalizedTimeTag,
                null,
                "latest",
                Pageable.unpaged()).getContent();
        List<ServicePackage> baseCandidates = packages.stream()
                .filter(servicePackage -> servicePackage.getStatus() == ServicePackageStatus.ONLINE)
                .filter(servicePackage -> Boolean.TRUE.equals(servicePackage.getIsAvailable()))
                .filter(ServicePackage::isModerationVisible)
                .filter(servicePackage -> !Boolean.TRUE.equals(servicePackage.getHiddenByProvider()))
                .filter(servicePackage -> ProvinceNames.matches(servicePackage.getCityCode(), normalizedCity))
                .filter(servicePackage -> normalizedScene == null
                        || servicePackage.getScene().equalsIgnoreCase(normalizedScene))
                .filter(servicePackage -> normalizedStyle == null
                        || servicePackage.getStyleTags().contains(normalizedStyle))
                .filter(servicePackage -> normalizedTimeTag == null
                        || servicePackage.getTimeTags().contains(normalizedTimeTag))
                .filter(servicePackage -> matchesPrice(servicePackage, minPriceCent, maxPriceCent))
                .filter(servicePackage -> availableDate == null
                        || servicePackage.getAvailableDates().contains(availableDate))
                .filter(servicePackage -> !"recommend".equals(normalizedSort)
                        || currentUser == null
                        || !currentUser.isProvider()
                        || !Objects.equals(servicePackage.getProviderId(), currentUser.getUserId()))
                .toList();
        Map<Long, PhotographerInfo> photographerInfos = photographerInfosWithProbe(baseCandidates);

        List<ServicePackage> candidates = baseCandidates.stream()
                .filter(servicePackage -> matchesServiceKeyword(
                        servicePackage,
                        photographerInfos.get(servicePackage.getProviderId()),
                        keyword))
                .toList();
        CustomerPreference preference = serviceRecommendationPreference(
                currentUser, normalizedCity, normalizedScene, normalizedStyle,
                minPriceCent, maxPriceCent, normalizedTimeTag);
        Map<Long, Recommendation> recommendations = "recommend".equals(normalizedSort)
                ? candidates.stream().collect(Collectors.toMap(ServicePackage::getId,
                servicePackage -> scoreServiceRecommendation(
                        servicePackage,
                        photographerInfos.get(servicePackage.getProviderId()),
                        preference,
                        feedSeed)))
                : Map.of();
        Comparator<ServicePackage> comparator = recommendations.isEmpty()
                ? resolveSort(normalizedSort)
                : Comparator.<ServicePackage>comparingInt(
                servicePackage -> recommendations.get(servicePackage.getId()).score()).reversed()
                .thenComparing(latestServiceComparator());
        List<ServicePackage> sortedPackages = candidates.stream()
                .sorted(comparator)
                .toList();
        if ("recommend".equals(normalizedSort)) {
            sortedPackages = diversifyServicePackages(sortedPackages);
        }
        List<ServicePackageCardDto> filtered = sortedPackages.stream()
                .map(servicePackage -> ServicePackageMapper.toCard(
                        servicePackage,
                        photographerInfos.get(servicePackage.getProviderId()),
                        recommendations.get(servicePackage.getId()) == null
                                ? null
                                : recommendations.get(servicePackage.getId()).limitedReasons()))
                .toList();

        int fromIndex = Math.min((safePage - 1) * safeSize, filtered.size());
        int toIndex = Math.min(fromIndex + safeSize, filtered.size());
        return new PageResult<>(filtered.subList(fromIndex, toIndex), safePage, safeSize, filtered.size());
    }

    private PageResult<ServicePackageCardDto> listOrdinaryServices(int safePage,
                                                                   int safeSize,
                                                                   String cityCode,
                                                                   String scene,
                                                                   String style,
                                                                   Long minPriceCent,
                                                                   Long maxPriceCent,
                                                                   LocalDate availableDate,
                                                                   String timeTag,
                                                                   String keyword,
                                                                   String sort) {
        Page<ServicePackage> packagePage = servicePackageRepository.findPublicPage(
                cityCode,
                scene,
                style,
                minPriceCent,
                maxPriceCent,
                availableDate == null ? null : availableDate.toString(),
                timeTag,
                normalizeKeyword(keyword),
                sort,
                PageRequest.of(safePage - 1, safeSize)
        );
        Map<Long, PhotographerInfo> photographerInfos = photographerInfosWithProbe(packagePage.getContent());
        List<ServicePackageCardDto> records = packagePage.getContent().stream()
                .map(servicePackage -> ServicePackageMapper.toCard(
                        servicePackage,
                        photographerInfos.get(servicePackage.getProviderId()),
                        null))
                .toList();
        return new PageResult<>(records, safePage, safeSize, packagePage.getTotalElements());
    }

    @Transactional(readOnly = true)
    public ServicePackageDetailDto getServiceDetail(Long serviceId) {
        return getServiceDetail(serviceId, null);
    }

    @Transactional(readOnly = true)
    public ServicePackageDetailDto getServiceDetail(Long serviceId, CurrentUser currentUser) {
        ServicePackage servicePackage = getServicePackage(serviceId);
        boolean privileged = canViewRestrictedServicePackage(servicePackage, currentUser);
        if (!servicePackage.isModerationVisible() && !privileged) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Service package not found: " + serviceId);
        }
        if (servicePackage.getStatus() == ServicePackageStatus.OFFLINE
                && !privileged) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Service package is offline");
        }
        return ServicePackageMapper.toDetail(
                servicePackage,
                photographerInfo(servicePackage.getProviderId()),
                privileged ? moderationView(servicePackage) : null);
    }

    @Transactional
    public ServicePackageDetailDto updateServicePackage(Long serviceId,
                                                        CurrentUser currentUser,
                                                        UpdateServicePackageRequest request) {
        ensureProvider(currentUser);
        if (request == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "request must not be null");
        }
        ServicePackage servicePackage = getOwnedServicePackage(serviceId, currentUser.getUserId());
        applyUpdate(servicePackage, request);
        ensureCompleteServicePackage(servicePackage);
        ServicePackage saved = servicePackageRepository.save(servicePackage);
        return ServicePackageMapper.toDetail(
                saved, photographerInfo(saved.getProviderId()), moderationView(saved));
    }

    @Transactional
    public ServicePackageDetailDto offlineServicePackage(Long serviceId, CurrentUser currentUser) {
        ensureProvider(currentUser);
        ServicePackage servicePackage = getOwnedServicePackage(serviceId, currentUser.getUserId());
        servicePackage.markOffline();
        ServicePackage saved = servicePackageRepository.save(servicePackage);
        return ServicePackageMapper.toDetail(
                saved, photographerInfo(saved.getProviderId()), moderationView(saved));
    }

    @Transactional(readOnly = true)
    public List<ServicePackageCardDto> listMyServicePackageHistory(CurrentUser currentUser) {
        ensureProviderOrAdmin(currentUser);
        List<ServicePackage> packages = servicePackageRepository.findOwnerHistory(currentUser.getUserId());
        Map<Long, PhotographerInfo> photographerInfos = photographerInfos(packages);
        return packages.stream()
                .map(servicePackage -> ServicePackageMapper.toCard(
                        servicePackage,
                        photographerInfos.get(servicePackage.getProviderId()),
                        null,
                        moderationView(servicePackage)))
                .toList();
    }

    @Transactional
    public void hideServicePackage(Long serviceId, CurrentUser currentUser) {
        ensureProvider(currentUser);
        ServicePackage servicePackage = getOwnedServicePackage(serviceId, currentUser.getUserId());
        servicePackage.hideForProvider();
        servicePackageRepository.save(servicePackage);
    }

    @Transactional
    public ReserveServicePackageResult reserveServicePackage(Long serviceId,
                                                             CurrentUser currentUser,
                                                             ReserveServicePackageRequest request) {
        String initialMessage = request == null ? null : request.getInitialMessage();
        StartServicePackageChatResult chat = startChat(
                serviceId,
                currentUser,
                startChatRequest(initialMessage)
        );
        ServicePackage saved = getServicePackage(serviceId);
        return new ReserveServicePackageResult(
                saved.getId(),
                chat.getConversationId(),
                saved.getStatus().name(),
                saved.getIsAvailable()
        );
    }

    @Transactional
    public ServicePackageInterestDto addInterest(Long serviceId, CurrentUser currentUser) {
        ensureCustomer(currentUser);
        ServicePackage servicePackage = getPublicInteractiveServicePackage(serviceId);
        if (Objects.equals(servicePackage.getProviderId(), currentUser.getUserId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Provider cannot add interest to own service package");
        }
        ServicePackageInterest interest = interestRepository
                .findByUserIdAndServicePackageId(currentUser.getUserId(), serviceId)
                .orElseGet(() -> {
                    ServicePackageInterest created = new ServicePackageInterest();
                    created.setUserId(currentUser.getUserId());
                    created.setServicePackageId(serviceId);
                    return interestRepository.save(created);
                });
        return toInterestDto(interest);
    }

    @Transactional
    public void cancelInterest(Long serviceId, CurrentUser currentUser) {
        ensureCustomer(currentUser);
        interestRepository.deleteByUserIdAndServicePackageId(currentUser.getUserId(), serviceId);
    }

    @Transactional(readOnly = true)
    public PageResult<ServicePackageCardDto> listMyInterests(CurrentUser currentUser,
                                                             int page,
                                                             int size,
                                                             String timeTag) {
        ensureCustomer(currentUser);
        int safePage = Math.max(page, 1);
        int safeSize = Math.max(1, Math.min(size, MAX_PAGE_SIZE));
        String normalizedTimeTag = normalizeTimeTagFilter(timeTag);
        List<Long> serviceIds = interestRepository.findByUserIdOrderByCreatedAtDesc(currentUser.getUserId())
                .stream()
                .map(ServicePackageInterest::getServicePackageId)
                .filter(Objects::nonNull)
                .toList();
        Map<Long, ServicePackage> packageById = servicePackageRepository.findAllById(serviceIds)
                .stream()
                .collect(Collectors.toMap(
                        ServicePackage::getId,
                        servicePackage -> servicePackage,
                        (left, right) -> left
                ));
        if (packageById.isEmpty() && !serviceIds.isEmpty()) {
            packageById = serviceIds.stream()
                    .map(serviceId -> servicePackageRepository.findById(serviceId).orElse(null))
                    .filter(Objects::nonNull)
                    .collect(Collectors.toMap(
                            ServicePackage::getId,
                            servicePackage -> servicePackage,
                            (left, right) -> left
                    ));
        }
        List<ServicePackage> packages = serviceIds.stream()
                .map(packageById::get)
                .filter(Objects::nonNull)
                .filter(ServicePackage::isModerationVisible)
                .filter(servicePackage -> normalizedTimeTag == null
                        || servicePackage.getTimeTags().contains(normalizedTimeTag))
                .toList();
        Map<Long, PhotographerInfo> photographerInfos = photographerInfos(packages);
        List<ServicePackageCardDto> cards = packages.stream()
                .map(servicePackage -> ServicePackageMapper.toCard(
                        servicePackage,
                        photographerInfos.get(servicePackage.getProviderId())))
                .toList();
        int fromIndex = Math.min((safePage - 1) * safeSize, cards.size());
        int toIndex = Math.min(fromIndex + safeSize, cards.size());
        return new PageResult<>(cards.subList(fromIndex, toIndex), safePage, safeSize, cards.size());
    }

    @Transactional
    public StartServicePackageChatResult startChat(Long serviceId,
                                                   CurrentUser currentUser,
                                                   StartServicePackageChatRequest request) {
        ensureCustomer(currentUser);
        ServicePackage servicePackage = getPublicInteractiveServicePackage(serviceId);
        if (Objects.equals(servicePackage.getProviderId(), currentUser.getUserId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Provider cannot start chat for own service package");
        }
        CreateConversationResult conversation = conversationService.createConversationWithInitialMessage(
                new CreateConversationCommand(
                        currentUser.getUserId(),
                        servicePackage.getProviderId(),
                        currentUser.getUserId(),
                        ConversationService.SOURCE_TYPE_SERVICE_PACKAGE,
                        servicePackage.getId(),
                        initialMessage(request == null ? null : request.getInitialMessage())
                )
        );
        return new StartServicePackageChatResult(
                servicePackage.getId(),
                conversation.getConversationId(),
                servicePackage.getStatus().name()
        );
    }

    private ServicePackage getServicePackage(Long serviceId) {
        if (serviceId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "serviceId must not be null");
        }
        return servicePackageRepository.findById(serviceId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND,
                        "Service package not found: " + serviceId));
    }

    private ServicePackage getPublicInteractiveServicePackage(Long serviceId) {
        ServicePackage servicePackage = getServicePackage(serviceId);
        if (servicePackage.getStatus() != ServicePackageStatus.ONLINE
                || !servicePackage.isModerationVisible()
                || Boolean.TRUE.equals(servicePackage.getHiddenByProvider())
                || !Boolean.TRUE.equals(servicePackage.getIsAvailable())) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                    "Service package is not publicly interactive");
        }
        return servicePackage;
    }

    private ServicePackage getOwnedServicePackage(Long serviceId, Long providerId) {
        if (serviceId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "serviceId must not be null");
        }
        return servicePackageRepository.findByIdAndProviderId(serviceId, providerId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND,
                        "Service package not found for current provider: " + serviceId));
    }

    private void validateCreateRequest(CreateServicePackageRequest request) {
        if (request == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "request must not be null");
        }
        requireText(request.getTitle(), "title must not be blank");
        requireText(request.getCityCode(), "cityCode must not be blank");
        requireText(request.getScene(), "scene must not be blank");
        requireText(request.getTimeDescription(), "timeDescription must not be blank");
        requirePositive(request.getBasePriceCent(), "basePriceCent must be positive");
        requirePositive(request.getDurationMinutes(), "durationMinutes must be positive");
        requireNonNegative(request.getOriginalCount(), "originalCount must not be negative");
        requireNonNegative(request.getRefinedCount(), "refinedCount must not be negative");
        requirePositive(request.getDeliveryDays(), "deliveryDays must be positive");
        if (normalizeStrings(request.getImages(), false).isEmpty()
                && normalizeIds(request.getPortfolioIds()).isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "发布橱窗至少需要上传 1 张图片");
        }
        normalizeTimeTags(request.getTimeTags());
    }

    private void ensureProvider(CurrentUser currentUser) {
        if (currentUser == null || currentUser.getUserId() == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Current user is required");
        }
        if (!currentUser.isProvider()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only provider can publish service packages");
        }
    }

    private void ensureProviderOrAdmin(CurrentUser currentUser) {
        if (currentUser == null || currentUser.getUserId() == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Current user is required");
        }
        if (!currentUser.isProvider() && !currentUser.isAdmin()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only provider can list own service package history");
        }
    }

    private void ensureCustomer(CurrentUser currentUser) {
        if (currentUser == null || currentUser.getUserId() == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Current user is required");
        }
        if (!currentUser.isCustomer()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only customer can reserve service packages");
        }
    }

    private void requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, message);
        }
    }

    private void requirePositive(Long value, String message) {
        if (value == null || value <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, message);
        }
    }

    private void requirePositive(Integer value, String message) {
        if (value == null || value <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, message);
        }
    }

    private void requireNonNegative(Integer value, String message) {
        if (value == null || value < 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, message);
        }
    }

    private boolean matchesPrice(ServicePackage servicePackage, Long minPriceCent, Long maxPriceCent) {
        Long price = servicePackage.getBasePriceCent();
        if (minPriceCent != null && price < minPriceCent) {
            return false;
        }
        return maxPriceCent == null || price <= maxPriceCent;
    }

    private void applyUpdate(ServicePackage servicePackage, UpdateServicePackageRequest request) {
        if (request.getTitle() != null) {
            servicePackage.setTitle(trim(request.getTitle()));
        }
        if (request.getCityCode() != null) {
            servicePackage.setCityCode(ProvinceNames.requireCode(request.getCityCode()));
        }
        if (request.getServiceArea() != null) {
            servicePackage.setServiceArea(trimToNull(request.getServiceArea()));
        }
        if (request.getScene() != null) {
            servicePackage.setScene(trim(request.getScene()));
        }
        if (request.getStyleTags() != null) {
            servicePackage.setStyleTags(normalizeTags(request.getStyleTags()));
        }
        if (request.getImages() != null) {
            servicePackage.setImages(normalizeStrings(request.getImages(), false));
        }
        if (request.getBasePriceCent() != null) {
            requirePositive(request.getBasePriceCent(), "basePriceCent must be positive");
            servicePackage.setBasePriceCent(request.getBasePriceCent());
        }
        if (request.getPriceRange() != null) {
            servicePackage.setPriceRange(trimToNull(request.getPriceRange()));
        }
        if (request.getDurationMinutes() != null) {
            requirePositive(request.getDurationMinutes(), "durationMinutes must be positive");
            servicePackage.setDurationMinutes(request.getDurationMinutes());
        }
        if (request.getOriginalCount() != null) {
            requireNonNegative(request.getOriginalCount(), "originalCount must not be negative");
            servicePackage.setOriginalCount(request.getOriginalCount());
        }
        if (request.getRefinedCount() != null) {
            requireNonNegative(request.getRefinedCount(), "refinedCount must not be negative");
            servicePackage.setRefinedCount(request.getRefinedCount());
        }
        if (request.getDeliveryDays() != null) {
            requirePositive(request.getDeliveryDays(), "deliveryDays must be positive");
            servicePackage.setDeliveryDays(request.getDeliveryDays());
        }
        if (request.getAvailableDates() != null) {
            servicePackage.setAvailableDates(normalizeDates(request.getAvailableDates()));
        }
        if (request.getPortfolioIds() != null) {
            List<Long> portfolioIds = normalizeIds(request.getPortfolioIds());
            ensureMaxImageCount(portfolioIds);
            fileReferenceValidator.requireExisting(portfolioIds, "portfolioIds");
            servicePackage.setPortfolioIds(portfolioIds);
        }
        if (request.getDescription() != null) {
            servicePackage.setDescription(trimToNull(request.getDescription()));
        }
        if (request.getTimeDescription() != null) {
            servicePackage.setTimeDescription(trim(request.getTimeDescription()));
        }
        if (request.getTimeTags() != null) {
            servicePackage.setTimeTags(normalizeTimeTags(request.getTimeTags()));
        }
        if (request.getStatus() != null) {
            servicePackage.setStatus(parseStatus(request.getStatus()));
        }
    }

    private void ensureCompleteServicePackage(ServicePackage servicePackage) {
        requireText(servicePackage.getTitle(), "title must not be blank");
        requireText(servicePackage.getCityCode(), "cityCode must not be blank");
        requireText(servicePackage.getScene(), "scene must not be blank");
        requireText(servicePackage.getTimeDescription(), "timeDescription must not be blank");
        requirePositive(servicePackage.getBasePriceCent(), "basePriceCent must be positive");
        requirePositive(servicePackage.getDurationMinutes(), "durationMinutes must be positive");
        requireNonNegative(servicePackage.getOriginalCount(), "originalCount must not be negative");
        requireNonNegative(servicePackage.getRefinedCount(), "refinedCount must not be negative");
        requirePositive(servicePackage.getDeliveryDays(), "deliveryDays must be positive");
    }

    private ServicePackageStatus parseStatus(String value) {
        try {
            return ServicePackageStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (RuntimeException ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unsupported service package status: " + value);
        }
    }

    private Comparator<ServicePackage> resolveSort(String sort) {
        if ("price_asc".equalsIgnoreCase(sort)) {
            return Comparator.comparing(ServicePackage::getBasePriceCent,
                    Comparator.nullsLast(Comparator.naturalOrder()))
                    .thenComparing(ServicePackage::getId, Comparator.nullsLast(Comparator.naturalOrder()));
        }
        if ("price_desc".equalsIgnoreCase(sort)) {
            return Comparator.comparing(ServicePackage::getBasePriceCent,
                    Comparator.nullsLast(Comparator.reverseOrder()))
                    .thenComparing(ServicePackage::getId, Comparator.nullsLast(Comparator.reverseOrder()));
        }
        if ("created_asc".equalsIgnoreCase(sort)) {
            return Comparator.comparing(ServicePackage::getCreatedAt,
                    Comparator.nullsLast(Comparator.naturalOrder()))
                    .thenComparing(ServicePackage::getId, Comparator.nullsLast(Comparator.naturalOrder()));
        }
        return latestServiceComparator();
    }

    private Comparator<ServicePackage> latestServiceComparator() {
        return Comparator.comparing(ServicePackage::getUpdatedAt,
                Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(ServicePackage::getId, Comparator.nullsLast(Comparator.reverseOrder()));
    }

    private String normalizeServiceSort(String sort) {
        if ("recommend".equalsIgnoreCase(trim(sort))) {
            return "recommend";
        }
        if ("price_asc".equalsIgnoreCase(trim(sort))) {
            return "price_asc";
        }
        if ("price_desc".equalsIgnoreCase(trim(sort))) {
            return "price_desc";
        }
        if ("created_asc".equalsIgnoreCase(trim(sort))) {
            return "created_asc";
        }
        return "latest";
    }

    private boolean matchesServiceKeyword(ServicePackage servicePackage,
                                          PhotographerInfo photographerInfo,
                                          String keyword) {
        String normalized = normalizeKeyword(keyword);
        if (normalized == null) {
            return true;
        }
        return containsKeyword(normalized,
                servicePackage.getTitle(),
                servicePackage.getDescription(),
                servicePackage.getServiceArea(),
                servicePackage.getScene(),
                photographerInfo == null ? null : photographerInfo.nickname())
                || listContainsKeyword(servicePackage.getStyleTags(), normalized);
    }

    private CustomerPreference serviceRecommendationPreference(CurrentUser currentUser,
                                                               String cityCode,
                                                               String scene,
                                                               String style,
                                                               Long minPriceCent,
                                                               Long maxPriceCent,
                                                               String timeTag) {
        Map<String, Integer> cityWeights = new LinkedHashMap<>();
        Map<String, Integer> sceneWeights = new LinkedHashMap<>();
        Map<String, Integer> styleWeights = new LinkedHashMap<>();
        Map<String, Integer> timeTagWeights = new LinkedHashMap<>();
        Map<LocalDate, Integer> desiredDateWeights = new LinkedHashMap<>();
        List<WeightedBudget> budgets = new ArrayList<>();
        Set<Long> interestedIds = new LinkedHashSet<>();
        Set<String> directCityCodes = new LinkedHashSet<>();

        RecommendationMatcher.addTextSignal(cityWeights, cityCode, 100);
        if (!isBlank(cityCode)) {
            directCityCodes.add(cityCode.trim().toLowerCase(Locale.ROOT));
        }
        RecommendationMatcher.addTextSignal(sceneWeights, scene, 100);
        RecommendationMatcher.addTextSignal(styleWeights, style, 100);
        RecommendationMatcher.addTextSignal(timeTagWeights, timeTag, 100);
        if (minPriceCent != null || maxPriceCent != null) {
            budgets.add(new WeightedBudget(minPriceCent, maxPriceCent, 100));
        }

        if (currentUser != null && currentUser.isCustomer() && currentUser.getUserId() != null) {
            Long customerId = currentUser.getUserId();
            userRepository.findById(customerId)
                    .map(User::getCityCode)
                    .ifPresent(value -> {
                        RecommendationMatcher.addTextSignal(
                                cityWeights, value, CUSTOMER_PROFILE_FULL_CONFIDENCE_WEIGHT);
                        if (!isBlank(value)) {
                            directCityCodes.add(value.trim().toLowerCase(Locale.ROOT));
                        }
                    });

            LocalDateTime now = LocalDateTime.now();
            List<Demand> demands = safeList(demandRepository.findActiveRecommendationSignals(
                    customerId, now, PageRequest.of(0, MAX_CUSTOMER_DEMAND_SIGNALS)));
            for (int index = 0; index < demands.size(); index++) {
                Demand demand = demands.get(index);
                if (!isValidCustomerSignal(demand, now)) {
                    continue;
                }
                int weight = Math.max(20, 60 - index * 4);
                RecommendationMatcher.addTextSignal(cityWeights, demand.getCityCode(), weight);
                RecommendationMatcher.addTextSignal(sceneWeights, demand.getScene(), weight);
                RecommendationMatcher.addTextSignals(styleWeights, demand.getStyleTags(), weight);
                RecommendationMatcher.addTextSignals(timeTagWeights, demand.getTimeTags(), weight);
                if (demand.getExpectedDate() != null) {
                    desiredDateWeights.merge(demand.getExpectedDate(), weight, Integer::sum);
                }
                if (demand.getBudgetMinCent() != null || demand.getBudgetMaxCent() != null) {
                    budgets.add(new WeightedBudget(
                            demand.getBudgetMinCent() == null ? null : demand.getBudgetMinCent().longValue(),
                            demand.getBudgetMaxCent() == null ? null : demand.getBudgetMaxCent().longValue(),
                            weight));
                }
            }

            List<ServicePackageInterest> interests = safeList(
                    interestRepository.findByUserIdAndCreatedAtGreaterThanEqualOrderByCreatedAtDesc(
                            customerId,
                            now.minusDays(CUSTOMER_INTEREST_LOOKBACK_DAYS),
                            PageRequest.of(0, MAX_CUSTOMER_INTEREST_SIGNALS)));
            interests.stream()
                    .map(ServicePackageInterest::getServicePackageId)
                    .filter(Objects::nonNull)
                    .forEach(interestedIds::add);
            Map<Long, ServicePackage> interestedPackages = interestedIds.isEmpty()
                    ? Map.of()
                    : safeList(servicePackageRepository.findAllById(interestedIds)).stream()
                    .filter(Objects::nonNull)
                    .collect(Collectors.toMap(ServicePackage::getId, value -> value, (left, right) -> left));
            for (int index = 0; index < interests.size(); index++) {
                ServicePackage interestedPackage = interestedPackages.get(interests.get(index).getServicePackageId());
                if (!isPublicRecommendationPackage(interestedPackage)) {
                    continue;
                }
                int weight = Math.max(4, 10 - index / 2);
                RecommendationMatcher.addTextSignal(cityWeights, interestedPackage.getCityCode(), weight);
                RecommendationMatcher.addTextSignal(sceneWeights, interestedPackage.getScene(), weight);
                RecommendationMatcher.addTextSignals(styleWeights, interestedPackage.getStyleTags(), weight);
                RecommendationMatcher.addTextSignals(timeTagWeights, interestedPackage.getTimeTags(), weight);
                if (interestedPackage.getBasePriceCent() != null) {
                    budgets.add(new WeightedBudget(
                            interestedPackage.getBasePriceCent(), interestedPackage.getBasePriceCent(), weight));
                }
            }
        }
        return new CustomerPreference(cityWeights, sceneWeights, styleWeights, budgets,
                timeTagWeights, desiredDateWeights, interestedIds, directCityCodes);
    }

    private Recommendation scoreServiceRecommendation(ServicePackage servicePackage,
                                                      PhotographerInfo photographerInfo,
                                                      CustomerPreference preference,
                                                      String feedSeed) {
        int score = 0;
        List<ReasonContribution> reasonContributions = new ArrayList<>();
        int cityScore = RecommendationMatcher.textScore(
                servicePackage.getCityCode(), preference.cityWeights(), 30,
                CUSTOMER_PROFILE_FULL_CONFIDENCE_WEIGHT);
        if (cityScore > 0) {
            score += cityScore;
            String normalizedCandidateCity = servicePackage.getCityCode() == null
                    ? null
                    : servicePackage.getCityCode().trim().toLowerCase(Locale.ROOT);
            reasonContributions.add(new ReasonContribution(
                    cityScore, 2,
                    preference.directCityCodes().contains(normalizedCandidateCity)
                            ? "同城匹配"
                            : "城市偏好匹配"));
        }
        int sceneScore = RecommendationMatcher.textScore(
                servicePackage.getScene(), preference.sceneWeights(), 18,
                CUSTOMER_PROFILE_FULL_CONFIDENCE_WEIGHT);
        if (sceneScore > 0) {
            score += sceneScore;
            reasonContributions.add(new ReasonContribution(sceneScore, 5, "场景匹配"));
        }
        int styleScore = RecommendationMatcher.tagScore(
                servicePackage.getStyleTags(), preference.styleWeights(), 25,
                CUSTOMER_PROFILE_FULL_CONFIDENCE_WEIGHT);
        if (styleScore > 0) {
            score += styleScore;
            reasonContributions.add(new ReasonContribution(
                    styleScore, 3, styleScore >= 17 ? "风格高度匹配" : "风格匹配"));
        }
        int priceScore = RecommendationMatcher.weightedPriceScore(
                servicePackage.getBasePriceCent(), preference.budgets(), 20,
                CUSTOMER_PROFILE_FULL_CONFIDENCE_WEIGHT);
        if (priceScore > 0) {
            score += priceScore;
            reasonContributions.add(new ReasonContribution(priceScore, 4, "价格合适"));
        } else if (preference.budgets().isEmpty() && isReasonableDefaultPrice(servicePackage.getBasePriceCent())) {
            score += 4;
            reasonContributions.add(new ReasonContribution(4, 4, "价格合适"));
        }
        int timeScore = Math.max(
                RecommendationMatcher.tagScore(
                        servicePackage.getTimeTags(), preference.timeTagWeights(), 15,
                        CUSTOMER_PROFILE_FULL_CONFIDENCE_WEIGHT),
                RecommendationMatcher.dateScore(
                        servicePackage.getAvailableDates(), preference.desiredDateWeights(), 15,
                        CUSTOMER_PROFILE_FULL_CONFIDENCE_WEIGHT));
        if (timeScore > 0) {
            score += timeScore;
            reasonContributions.add(new ReasonContribution(timeScore, 1, "近期可约"));
        } else if (preference.timeTagWeights().isEmpty()
                && preference.desiredDateWeights().isEmpty()
                && hasNearAvailableDate(servicePackage)) {
            score += 4;
            reasonContributions.add(new ReasonContribution(4, 1, "近期可约"));
        }
        int creditScore = creditScore(photographerInfo);
        score += creditScore;
        if (creditScore > 0) {
            reasonContributions.add(new ReasonContribution(creditScore, 0, "信用较高"));
        }
        if (hasWorkCompleteness(servicePackage)) {
            score += 5;
            reasonContributions.add(new ReasonContribution(5, 6, "作品完整"));
        }
        score += freshnessScore(servicePackage.getUpdatedAt());
        if (preference.interestedServiceIds().contains(servicePackage.getId())) {
            score += 4;
        }
        score += feedSeedScore(feedSeed, servicePackage.getId());
        List<String> reasons = reasonContributions.stream()
                .sorted(Comparator.comparingInt(ReasonContribution::score).reversed()
                        .thenComparingInt(ReasonContribution::priority))
                .map(ReasonContribution::reason)
                .distinct()
                .limit(3)
                .toList();
        return new Recommendation(score, reasons);
    }

    private boolean isValidCustomerSignal(Demand demand, LocalDateTime now) {
        return demand != null
                && demand.getStatus() == DemandStatus.OPEN
                && demand.isModerationVisible()
                && !Boolean.TRUE.equals(demand.getHiddenByCustomer())
                && (demand.getExpireTime() == null || demand.getExpireTime().isAfter(now));
    }

    private boolean isPublicRecommendationPackage(ServicePackage servicePackage) {
        return servicePackage != null
                && servicePackage.getStatus() == ServicePackageStatus.ONLINE
                && servicePackage.isModerationVisible()
                && !Boolean.TRUE.equals(servicePackage.getHiddenByProvider());
    }

    private <T> List<T> safeList(List<T> values) {
        return values == null ? List.of() : values;
    }

    private int creditScore(PhotographerInfo photographerInfo) {
        if (photographerInfo == null || photographerInfo.creditScore() == null) {
            return 0;
        }
        double value = photographerInfo.creditScore().doubleValue();
        if (value >= 85) {
            return 10;
        }
        if (value >= 75) {
            return 6;
        }
        return 0;
    }

    private int freshnessScore(LocalDateTime updatedAt) {
        if (updatedAt == null) {
            return 0;
        }
        long days = ChronoUnit.DAYS.between(updatedAt.toLocalDate(), LocalDate.now());
        if (days <= 3) {
            return 10;
        }
        if (days <= 7) {
            return 6;
        }
        return days <= 30 ? 2 : 0;
    }

    private boolean hasNearAvailableDate(ServicePackage servicePackage) {
        if (servicePackage.getAvailableDates() == null) {
            return false;
        }
        LocalDate today = LocalDate.now();
        LocalDate limit = today.plusDays(30);
        return servicePackage.getAvailableDates().stream()
                .filter(Objects::nonNull)
                .anyMatch(date -> !date.isBefore(today) && !date.isAfter(limit));
    }

    private boolean hasWorkCompleteness(ServicePackage servicePackage) {
        boolean hasCover = (servicePackage.getImages() != null && !servicePackage.getImages().isEmpty())
                || (servicePackage.getPortfolioIds() != null && !servicePackage.getPortfolioIds().isEmpty());
        return hasCover && !isBlank(servicePackage.getDescription());
    }

    private boolean priceMatches(Long price, Long minPriceCent, Long maxPriceCent) {
        if (price == null || (minPriceCent == null && maxPriceCent == null)) {
            return false;
        }
        if (minPriceCent != null && price < minPriceCent) {
            return false;
        }
        return maxPriceCent == null || price <= maxPriceCent;
    }

    private boolean isReasonableDefaultPrice(Long price) {
        return price != null && price >= 30_000L && price <= 150_000L;
    }

    private int feedSeedScore(String feedSeed, Long id) {
        if (isBlank(feedSeed) || id == null) {
            return 0;
        }
        return Math.floorMod(Objects.hash(feedSeed, id), 11) - 5;
    }

    private List<ServicePackage> diversifyServicePackages(List<ServicePackage> sortedPackages) {
        if (sortedPackages == null || sortedPackages.size() < 3) {
            return sortedPackages;
        }
        List<ServicePackage> pool = new ArrayList<>(sortedPackages);
        List<ServicePackage> result = new ArrayList<>(sortedPackages.size());
        while (!pool.isEmpty()) {
            int selectedIndex = 0;
            int window = Math.min(pool.size(), 8);
            for (int i = 0; i < window; i++) {
                if (!isTooSimilarServicePackage(pool.get(i), result)) {
                    selectedIndex = i;
                    break;
                }
            }
            result.add(pool.remove(selectedIndex));
        }
        return result;
    }

    private boolean isTooSimilarServicePackage(ServicePackage candidate, List<ServicePackage> result) {
        if (candidate == null || result.size() < 2) {
            return false;
        }
        ServicePackage first = result.get(result.size() - 1);
        ServicePackage second = result.get(result.size() - 2);
        boolean sameProvider = Objects.equals(candidate.getProviderId(), first.getProviderId())
                && Objects.equals(candidate.getProviderId(), second.getProviderId());
        boolean sameCity = equalsIgnoreCase(candidate.getCityCode(), first.getCityCode())
                && equalsIgnoreCase(candidate.getCityCode(), second.getCityCode());
        boolean sameStyle = sharesAnyStyle(candidate.getStyleTags(), first.getStyleTags())
                && sharesAnyStyle(candidate.getStyleTags(), second.getStyleTags());
        return sameProvider || sameCity || sameStyle;
    }

    private boolean sharesAnyStyle(List<String> left, List<String> right) {
        if (left == null || right == null || left.isEmpty() || right.isEmpty()) {
            return false;
        }
        Set<String> normalizedRight = right.stream()
                .filter(Objects::nonNull)
                .map(value -> value.trim().toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());
        return left.stream()
                .filter(Objects::nonNull)
                .map(value -> value.trim().toLowerCase(Locale.ROOT))
                .anyMatch(normalizedRight::contains);
    }

    private String normalizeKeyword(String keyword) {
        if (isBlank(keyword)) {
            return null;
        }
        return keyword.trim().toLowerCase(Locale.ROOT);
    }

    private boolean containsKeyword(String keyword, String... values) {
        for (String value : values) {
            if (value != null && value.toLowerCase(Locale.ROOT).contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    private boolean listContainsKeyword(List<String> values, String keyword) {
        if (values == null) {
            return false;
        }
        return values.stream()
                .filter(Objects::nonNull)
                .anyMatch(value -> value.toLowerCase(Locale.ROOT).contains(keyword));
    }

    private boolean equalsIgnoreCase(String left, String right) {
        return left != null && right != null && left.equalsIgnoreCase(right.trim());
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private boolean canViewRestrictedServicePackage(ServicePackage servicePackage, CurrentUser currentUser) {
        return currentUser != null
                && currentUser.getUserId() != null
                && (currentUser.isAdmin() || Objects.equals(servicePackage.getProviderId(), currentUser.getUserId()));
    }

    private ModerationView moderationView(ServicePackage servicePackage) {
        return new ModerationView(
                servicePackage.getModerationStatus(),
                servicePackage.getModeratedAt(),
                servicePackage.getModerationReason());
    }

    private List<String> normalizeTags(List<String> tags) {
        if (tags == null) {
            return List.of();
        }
        return tags.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .map(value -> value.toLowerCase(Locale.ROOT))
                .distinct()
                .toList();
    }

    private List<String> normalizeStrings(List<String> values, boolean lowerCase) {
        if (values == null) {
            return List.of();
        }
        return values.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .map(value -> lowerCase ? value.toLowerCase(Locale.ROOT) : value)
                .distinct()
                .toList();
    }

    private List<String> normalizeTimeTags(List<String> tags) {
        List<String> normalized = normalizeStrings(tags, false).stream()
                .map(value -> value.toUpperCase(Locale.ROOT))
                .distinct()
                .toList();
        for (String tag : normalized) {
            if (!SUPPORTED_TIME_TAGS.contains(tag)) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unsupported timeTag: " + tag);
            }
        }
        return normalized;
    }

    private List<LocalDate> normalizeDates(List<LocalDate> dates) {
        if (dates == null) {
            return List.of();
        }
        return dates.stream()
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .toList();
    }

    private List<Long> normalizeIds(List<Long> ids) {
        if (ids == null) {
            return List.of();
        }
        return ids.stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();
    }

    private void ensureMaxImageCount(List<Long> ids) {
        if (ids != null && ids.size() > MAX_IMAGE_COUNT) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "最多只能上传 9 张图片");
        }
    }

    private String normalizeFilter(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeTimeTagFilter(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        if (!SUPPORTED_TIME_TAGS.contains(normalized)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unsupported timeTag: " + value);
        }
        return normalized;
    }

    private String initialMessage(String value) {
        String normalized = trimToNull(value);
        return normalized == null ? DEFAULT_RESERVE_MESSAGE : normalized;
    }

    private StartServicePackageChatRequest startChatRequest(String initialMessage) {
        StartServicePackageChatRequest request = new StartServicePackageChatRequest();
        request.setInitialMessage(initialMessage);
        return request;
    }

    private ServicePackageInterestDto toInterestDto(ServicePackageInterest interest) {
        return new ServicePackageInterestDto(
                interest.getId(),
                interest.getUserId(),
                interest.getServicePackageId(),
                interest.getCreatedAt()
        );
    }

    private Map<Long, PhotographerInfo> photographerInfos(List<ServicePackage> servicePackages) {
        LinkedHashSet<Long> photographerIds = servicePackages.stream()
                .map(ServicePackage::getProviderId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (photographerIds.isEmpty()) {
            return Map.of();
        }

        Map<Long, User> usersById = userRepository.findAllById(photographerIds).stream()
                .collect(Collectors.toMap(User::getId, user -> user, (left, right) -> left, LinkedHashMap::new));
        Map<Long, ProviderProfile> profilesByUserId = providerProfileMapper == null
                ? Map.of()
                : providerProfileMapper.selectList(
                        new LambdaQueryWrapper<ProviderProfile>().in(ProviderProfile::getUserId, photographerIds))
                .stream()
                .filter(profile -> profile.getUserId() != null)
                .collect(Collectors.toMap(
                        ProviderProfile::getUserId,
                        profile -> profile,
                        (left, right) -> left,
                        LinkedHashMap::new));
        Map<Long, java.math.BigDecimal> creditScores = creditSnapshotService.getDisplayCreditScores(usersById.keySet());

        Map<Long, PhotographerInfo> infos = new LinkedHashMap<>();
        photographerIds.forEach(photographerId -> {
            User user = usersById.get(photographerId);
            if (user == null) {
                infos.put(photographerId, new PhotographerInfo(photographerId, null, null, null, null));
                return;
            }
            ProviderProfile providerProfile = profilesByUserId.get(photographerId);
            Long avatarFileId = providerProfile != null && providerProfile.getProviderAvatarFileId() != null
                    ? providerProfile.getProviderAvatarFileId()
                    : user.getAvatarFileId();
            String nickname = providerProfile != null
                    && providerProfile.getDisplayName() != null
                    && !providerProfile.getDisplayName().isBlank()
                    ? providerProfile.getDisplayName()
                    : user.getNickname();
            infos.put(photographerId, new PhotographerInfo(
                    photographerId,
                    nickname,
                    avatarFileId,
                    null,
                    creditScores.get(photographerId)));
        });
        return infos;
    }

    private Map<Long, PhotographerInfo> photographerInfosWithProbe(List<ServicePackage> servicePackages) {
        long metadataStartedAt = servicePackagePerformanceProbeEnabled ? System.nanoTime() : 0L;
        Map<Long, PhotographerInfo> infos = photographerInfos(servicePackages);
        if (servicePackagePerformanceProbeEnabled) {
            double metadataTimeMs = (System.nanoTime() - metadataStartedAt) / 1_000_000.0d;
            LOGGER.info(
                    "event=service-package-metadata runId={} metadataTimeMs={} candidateCount={} photographerCount={}",
                    MDC.get("servicePackagePerformanceRunId"),
                    String.format(Locale.ROOT, "%.3f", metadataTimeMs),
                    servicePackages.size(),
                    infos.size()
            );
        }
        return infos;
    }

    private PhotographerInfo photographerInfo(Long photographerId) {
        if (photographerId == null) {
            return null;
        }
        return userRepository.findById(photographerId)
                .map(user -> {
                    ProviderProfile providerProfile = providerProfileMapper == null ? null : providerProfileMapper.selectOne(
                            new LambdaQueryWrapper<ProviderProfile>().eq(ProviderProfile::getUserId, photographerId)
                    );
                    Long avatarFileId = providerProfile != null && providerProfile.getProviderAvatarFileId() != null
                            ? providerProfile.getProviderAvatarFileId()
                            : user.getAvatarFileId();
                    String nickname = providerProfile != null
                            && providerProfile.getDisplayName() != null
                            && !providerProfile.getDisplayName().isBlank()
                            ? providerProfile.getDisplayName()
                            : user.getNickname();
                    return new PhotographerInfo(
                            user.getId(),
                            nickname,
                            avatarFileId,
                            null,
                            creditSnapshotService.getDisplayCreditScore(user.getId()));
                })
                .orElse(new PhotographerInfo(photographerId, null, null, null, null));
    }

    private String trim(String value) {
        return value == null ? null : value.trim();
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private record CustomerPreference(Map<String, Integer> cityWeights,
                                      Map<String, Integer> sceneWeights,
                                      Map<String, Integer> styleWeights,
                                      List<WeightedBudget> budgets,
                                      Map<String, Integer> timeTagWeights,
                                      Map<LocalDate, Integer> desiredDateWeights,
                                      Set<Long> interestedServiceIds,
                                      Set<String> directCityCodes) {
    }

    private record ReasonContribution(int score, int priority, String reason) {
    }

    private record Recommendation(int score, List<String> reasons) {
        private List<String> limitedReasons() {
            if (reasons == null || reasons.isEmpty()) {
                return List.of();
            }
            return reasons.stream().limit(3).toList();
        }
    }
}
