package com.action.camera.servicepackage.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.page.PageResult;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.domain.FileRecord;
import com.action.camera.domain.User;
import com.action.camera.message.model.CreateConversationCommand;
import com.action.camera.message.model.CreateConversationResult;
import com.action.camera.message.service.ConversationService;
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
import com.action.camera.repository.FileRepository;
import com.action.camera.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.Map;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ServicePackageService {

    private static final int MAX_PAGE_SIZE = 50;
    private static final String DEFAULT_RESERVE_MESSAGE = "I would like to reserve this service package.";
    private static final Set<String> SUPPORTED_TIME_TAGS = Set.of(
            "NEAR_3_DAYS",
            "NEAR_7_DAYS",
            "NEAR_1_MONTH"
    );

    private final ServicePackageRepository servicePackageRepository;
    private final ServicePackageInterestRepository interestRepository;
    private final ConversationService conversationService;
    private final UserRepository userRepository;
    private final FileRepository fileRepository;

    public ServicePackageService(ServicePackageRepository servicePackageRepository,
                                 ServicePackageInterestRepository interestRepository,
                                 ConversationService conversationService,
                                 UserRepository userRepository,
                                 FileRepository fileRepository) {
        this.servicePackageRepository = servicePackageRepository;
        this.interestRepository = interestRepository;
        this.conversationService = conversationService;
        this.userRepository = userRepository;
        this.fileRepository = fileRepository;
    }

    @Transactional
    public CreateServicePackageResult createServicePackage(CurrentUser currentUser,
                                                           CreateServicePackageRequest request) {
        ensureProvider(currentUser);
        validateCreateRequest(request);

        ServicePackage servicePackage = new ServicePackage();
        servicePackage.setProviderId(currentUser.getUserId());
        servicePackage.setTitle(trim(request.getTitle()));
        servicePackage.setCityCode(trim(request.getCityCode()));
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
        servicePackage.setPortfolioIds(normalizeIds(request.getPortfolioIds()));
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
        int safePage = Math.max(page, 1);
        int safeSize = Math.max(1, Math.min(size, MAX_PAGE_SIZE));
        String normalizedCity = normalizeFilter(cityCode);
        String normalizedScene = normalizeFilter(scene);
        String normalizedStyle = normalizeFilter(style);
        String normalizedTimeTag = normalizeTimeTagFilter(timeTag);

        List<ServicePackage> packages = servicePackageRepository.findByStatus(ServicePackageStatus.ONLINE);
        Map<Long, PhotographerInfo> photographerInfos = photographerInfos(packages);

        List<ServicePackageCardDto> filtered = packages.stream()
                .filter(servicePackage -> servicePackage.getStatus() == ServicePackageStatus.ONLINE)
                .filter(servicePackage -> normalizedCity == null
                        || servicePackage.getCityCode().equalsIgnoreCase(normalizedCity))
                .filter(servicePackage -> normalizedScene == null
                        || servicePackage.getScene().equalsIgnoreCase(normalizedScene))
                .filter(servicePackage -> normalizedStyle == null
                        || servicePackage.getStyleTags().contains(normalizedStyle))
                .filter(servicePackage -> normalizedTimeTag == null
                        || servicePackage.getTimeTags().contains(normalizedTimeTag))
                .filter(servicePackage -> matchesPrice(servicePackage, minPriceCent, maxPriceCent))
                .filter(servicePackage -> availableDate == null
                        || servicePackage.getAvailableDates().contains(availableDate))
                .sorted(resolveSort(sort))
                .map(servicePackage -> ServicePackageMapper.toCard(
                        servicePackage,
                        photographerInfos.get(servicePackage.getProviderId())))
                .toList();

        int fromIndex = Math.min((safePage - 1) * safeSize, filtered.size());
        int toIndex = Math.min(fromIndex + safeSize, filtered.size());
        return new PageResult<>(filtered.subList(fromIndex, toIndex), safePage, safeSize, filtered.size());
    }

    @Transactional(readOnly = true)
    public ServicePackageDetailDto getServiceDetail(Long serviceId) {
        return getServiceDetail(serviceId, null);
    }

    @Transactional(readOnly = true)
    public ServicePackageDetailDto getServiceDetail(Long serviceId, CurrentUser currentUser) {
        ServicePackage servicePackage = getServicePackage(serviceId);
        if (servicePackage.getStatus() == ServicePackageStatus.OFFLINE
                && !canViewOfflineServicePackage(servicePackage, currentUser)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Service package is offline");
        }
        return ServicePackageMapper.toDetail(servicePackage, photographerInfo(servicePackage.getProviderId()));
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
        return ServicePackageMapper.toDetail(saved, photographerInfo(saved.getProviderId()));
    }

    @Transactional
    public ServicePackageDetailDto offlineServicePackage(Long serviceId, CurrentUser currentUser) {
        ensureProvider(currentUser);
        ServicePackage servicePackage = getOwnedServicePackage(serviceId, currentUser.getUserId());
        servicePackage.markOffline();
        ServicePackage saved = servicePackageRepository.save(servicePackage);
        return ServicePackageMapper.toDetail(saved, photographerInfo(saved.getProviderId()));
    }

    @Transactional(readOnly = true)
    public List<ServicePackageCardDto> listMyServicePackageHistory(CurrentUser currentUser) {
        ensureProviderOrAdmin(currentUser);
        List<ServicePackage> packages = servicePackageRepository.findOwnerHistory(currentUser.getUserId());
        Map<Long, PhotographerInfo> photographerInfos = photographerInfos(packages);
        return packages.stream()
                .map(servicePackage -> ServicePackageMapper.toCard(
                        servicePackage,
                        photographerInfos.get(servicePackage.getProviderId())))
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
                null,
                saved.getStatus().name(),
                saved.getIsAvailable()
        );
    }

    @Transactional
    public ServicePackageInterestDto addInterest(Long serviceId, CurrentUser currentUser) {
        ensureCustomer(currentUser);
        ServicePackage servicePackage = getOnlineServicePackage(serviceId);
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
        List<ServicePackage> packages = interestRepository.findByUserIdOrderByCreatedAtDesc(currentUser.getUserId())
                .stream()
                .map(interest -> servicePackageRepository.findById(interest.getServicePackageId()))
                .flatMap(Optional::stream)
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
        ServicePackage servicePackage = getOnlineServicePackage(serviceId);
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

    private ServicePackage getOnlineServicePackage(Long serviceId) {
        ServicePackage servicePackage = getServicePackage(serviceId);
        if (servicePackage.getStatus() != ServicePackageStatus.ONLINE) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "Service package is not online");
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
            servicePackage.setCityCode(trim(request.getCityCode()));
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
            servicePackage.setPortfolioIds(normalizeIds(request.getPortfolioIds()));
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
            return Comparator.comparing(ServicePackage::getBasePriceCent);
        }
        if ("price_desc".equalsIgnoreCase(sort)) {
            return Comparator.comparing(ServicePackage::getBasePriceCent).reversed();
        }
        if ("created_asc".equalsIgnoreCase(sort)) {
            return Comparator.comparing(ServicePackage::getCreatedAt,
                    Comparator.nullsLast(Comparator.naturalOrder()));
        }
        return Comparator.comparing(ServicePackage::getUpdatedAt,
                Comparator.nullsFirst(Comparator.naturalOrder())).reversed();
    }

    private boolean canViewOfflineServicePackage(ServicePackage servicePackage, CurrentUser currentUser) {
        return currentUser != null
                && currentUser.getUserId() != null
                && (currentUser.isAdmin() || Objects.equals(servicePackage.getProviderId(), currentUser.getUserId()));
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
        return servicePackages.stream()
                .map(ServicePackage::getProviderId)
                .filter(Objects::nonNull)
                .distinct()
                .map(this::photographerInfo)
                .collect(Collectors.toMap(
                        PhotographerInfo::photographerId,
                        info -> info,
                        (left, right) -> left
                ));
    }

    private PhotographerInfo photographerInfo(Long photographerId) {
        if (photographerId == null) {
            return null;
        }
        return userRepository.findById(photographerId)
                .map(user -> new PhotographerInfo(
                        user.getId(),
                        user.getNickname(),
                        user.getAvatarFileId(),
                        avatarUrl(user)))
                .orElse(new PhotographerInfo(photographerId, null, null, null));
    }

    private String avatarUrl(User user) {
        Long avatarFileId = user.getAvatarFileId();
        if (avatarFileId == null) {
            return null;
        }
        return fileRepository.findById(avatarFileId)
                .map(FileRecord::getUrl)
                .orElse(null);
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
}
