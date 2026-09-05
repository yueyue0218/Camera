package com.action.camera.demand.service;

import com.action.camera.admin.dto.ModerationView;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.page.PageResult;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.demand.domain.Demand;
import com.action.camera.demand.domain.DemandResponse;
import com.action.camera.demand.domain.DemandResponseStatus;
import com.action.camera.demand.domain.DemandStatus;
import com.action.camera.demand.dto.AcceptDemandResponseResult;
import com.action.camera.demand.dto.AcceptedDemandResponseSnapshot;
import com.action.camera.demand.dto.CreateDemandRequest;
import com.action.camera.demand.dto.CreateDemandResponseRequest;
import com.action.camera.demand.dto.DemandDto;
import com.action.camera.demand.dto.DemandResponseDto;
import com.action.camera.demand.repository.DemandRepository;
import com.action.camera.demand.repository.DemandResponseRepository;
import com.action.camera.message.model.CreateConversationCommand;
import com.action.camera.message.model.CreateConversationResult;
import com.action.camera.message.service.ConversationService;
import com.action.camera.notification.dto.NotificationCreateRequest;
import com.action.camera.notification.service.NotificationService;
import com.action.camera.repository.UserRepository;
import com.action.camera.servicepackage.domain.ServicePackage;
import com.action.camera.servicepackage.domain.ServicePackageStatus;
import com.action.camera.servicepackage.repository.ServicePackageRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class DemandService {

    private static final int DEFAULT_EXPIRE_DAYS = 30;
    private static final int MAX_IMAGE_COUNT = 9;
    private static final String DEFAULT_ACCEPT_INITIAL_MESSAGE = "已接受约拍响应，会话已开启。";
    private static final Set<String> SUPPORTED_TIME_TAGS = Set.of(
            "NEAR_3_DAYS",
            "NEAR_7_DAYS",
            "NEAR_1_MONTH"
    );

    private final DemandRepository demandRepository;
    private final DemandResponseRepository responseRepository;
    private final ConversationService conversationService;
    private final NotificationService notificationService;
    private final UserRepository userRepository;
    private final ServicePackageRepository servicePackageRepository;

    public DemandService(DemandRepository demandRepository,
                         DemandResponseRepository responseRepository,
                         ConversationService conversationService,
                         NotificationService notificationService,
                         UserRepository userRepository,
                         ServicePackageRepository servicePackageRepository) {
        this.demandRepository = demandRepository;
        this.responseRepository = responseRepository;
        this.conversationService = conversationService;
        this.notificationService = notificationService;
        this.userRepository = userRepository;
        this.servicePackageRepository = servicePackageRepository;
    }

    @Transactional
    public DemandDto createDemand(CurrentUser user, CreateDemandRequest request) {
        requireCustomer(user);
        validateDemandRequest(request);
        LocalDateTime now = LocalDateTime.now();
        Demand demand = new Demand(
                user.getUserId(),
                trim(request.getScene()),
                normalizeTags(request.getStyleTags()),
                request.getExpectedDate(),
                trim(request.getTimeSlot()),
                trim(request.getTimeDescription()),
                normalizeTimeTags(request.getTimeTags()),
                trim(request.getCityCode()),
                trim(request.getLocation()),
                request.getBudgetMinCent(),
                request.getBudgetMaxCent(),
                trim(request.getDescription()),
                normalizeIds(request.getReferenceFileIds()),
                now,
                now.plusDays(DEFAULT_EXPIRE_DAYS)
        );
        Demand savedDemand = demandRepository.save(demand);
        return toDemandDto(savedDemand);
    }

    @Transactional(readOnly = true)
    public PageResult<DemandDto> listDemands(int page, int size, String cityCode, String scene, String status) {
        return listDemands(page, size, cityCode, scene, status, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public PageResult<DemandDto> listDemands(int page,
                                             int size,
                                             String cityCode,
                                             String scene,
                                             String status,
                                             LocalDate expectedDate,
                                             String styleTag,
                                             Integer minBudgetCent,
                                             Integer maxBudgetCent) {
        return listDemands(page, size, cityCode, scene, status, expectedDate, styleTag,
                minBudgetCent, maxBudgetCent, null);
    }

    @Transactional(readOnly = true)
    public PageResult<DemandDto> listDemands(int page,
                                             int size,
                                             String cityCode,
                                             String scene,
                                             String status,
                                             LocalDate expectedDate,
                                             String styleTag,
                                             Integer minBudgetCent,
                                             Integer maxBudgetCent,
                                             String timeTag) {
        return listDemands(page, size, cityCode, scene, status, expectedDate, styleTag,
                minBudgetCent, maxBudgetCent, timeTag, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public PageResult<DemandDto> listDemands(int page,
                                             int size,
                                             String cityCode,
                                             String scene,
                                             String status,
                                             LocalDate expectedDate,
                                             String styleTag,
                                             Integer minBudgetCent,
                                             Integer maxBudgetCent,
                                             String timeTag,
                                             String keyword,
                                             String sort,
                                             String feedSeed,
                                             CurrentUser currentUser) {
        int safePage = Math.max(page, 1);
        int safeSize = Math.max(1, Math.min(size, 50));
        String normalizedTag = isBlank(styleTag) ? null : styleTag.trim().toLowerCase(Locale.ROOT);
        String normalizedCity = normalizeTextFilter(cityCode);
        String normalizedScene = normalizeTextFilter(scene);
        String normalizedTimeTag = normalizeTimeTagFilter(timeTag);
        String normalizedSort = normalizeDemandSort(sort);
        DemandStatus publicStatus = resolvePublicStatusFilter(status);
        if (publicStatus == null) {
            return new PageResult<>(List.of(), safePage, safeSize, 0);
        }
        boolean shouldRecommend = "recommend".equals(normalizedSort);
        if (!shouldRecommend) {
            Page<Demand> demandPage = demandRepository.findPublicPage(
                    normalizedCity,
                    normalizedScene,
                    normalizedTag,
                    expectedDate,
                    normalizedTimeTag,
                    minBudgetCent,
                    maxBudgetCent,
                    normalizeKeyword(keyword),
                    PageRequest.of(safePage - 1, safeSize));
            Map<Long, CustomerInfo> customers = loadCustomerInfo(demandPage.getContent());
            List<DemandDto> records = demandPage.getContent().stream()
                    .map(demand -> toDemandDto(demand, null, customers))
                    .toList();
            return new PageResult<>(records, safePage, safeSize, demandPage.getTotalElements());
        }

        List<Demand> publicDemands = demandRepository.findByStatus(publicStatus);
        Map<Long, CustomerInfo> customers = loadCustomerInfo(publicDemands);
        List<Demand> candidates = publicDemands.stream()
                .filter(Demand::isModerationVisible)
                .filter(demand -> !Boolean.TRUE.equals(demand.getHiddenByCustomer()))
                .filter(demand -> normalizedCity == null || equalsIgnoreCase(demand.getCityCode(), normalizedCity))
                .filter(demand -> normalizedScene == null || equalsIgnoreCase(demand.getScene(), normalizedScene))
                .filter(demand -> expectedDate == null || expectedDate.equals(demand.getExpectedDate()))
                .filter(demand -> normalizedTag == null || demand.getStyleTags().contains(normalizedTag))
                .filter(demand -> normalizedTimeTag == null || demand.getTimeTags().contains(normalizedTimeTag))
                .filter(demand -> matchesBudget(demand, minBudgetCent, maxBudgetCent))
                .filter(demand -> matchesDemandKeyword(demand, keyword, customers))
                .collect(Collectors.toList());
        PhotographerPreference preference = demandRecommendationPreference(
                currentUser, normalizedCity, normalizedTag, minBudgetCent, maxBudgetCent);
        Set<Long> respondedDemandIds = respondedDemandIds(currentUser, candidates, shouldRecommend);
        Map<Long, Recommendation> recommendations = shouldRecommend
                ? candidates.stream().collect(Collectors.toMap(Demand::getId,
                        demand -> scoreDemandRecommendation(demand, preference, normalizedTimeTag, respondedDemandIds, feedSeed)))
                : Map.of();
        Comparator<Demand> comparator = recommendations.isEmpty()
                ? latestDemandComparator()
                : Comparator.<Demand>comparingInt(demand -> recommendations.get(demand.getId()).score()).reversed()
                .thenComparing(latestDemandComparator());
        List<Demand> sortedDemands = candidates.stream()
                .sorted(comparator)
                .collect(Collectors.toList());
        if (shouldRecommend) {
            sortedDemands = diversifyDemands(sortedDemands);
        }
        List<DemandDto> filtered = sortedDemands.stream()
                .map(demand -> toDemandDto(demand, recommendations.get(demand.getId()), customers))
                .collect(Collectors.toList());
        int fromIndex = Math.min((safePage - 1) * safeSize, filtered.size());
        int toIndex = Math.min(fromIndex + safeSize, filtered.size());
        return new PageResult<>(filtered.subList(fromIndex, toIndex), safePage, safeSize, filtered.size());
    }

    @Transactional(readOnly = true)
    public List<DemandDto> listMyDemandHistory(CurrentUser user) {
        requireCustomerOrAdmin(user);
        return demandRepository.findOwnerHistory(user.getUserId(), List.of(DemandStatus.OPEN, DemandStatus.CLOSED))
                .stream()
                .map(this::toOwnerDemandDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public DemandDto updateDemand(Long demandId, CurrentUser user, CreateDemandRequest request) {
        requireCustomer(user);
        if (request == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "request must not be null");
        }
        Demand demand = findOwnedDemand(demandId, user);
        if (demand.getStatus() != DemandStatus.OPEN) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "only open demands can be updated");
        }
        applyUpdate(demand, request);
        validateBudgetRange(demand.getBudgetMinCent(), demand.getBudgetMaxCent());
        return toDemandDto(demandRepository.save(demand));
    }

    @Transactional
    public DemandDto closeDemand(Long demandId, CurrentUser user) {
        requireCustomer(user);
        Demand demand = findOwnedDemand(demandId, user);
        demand.close();
        return toDemandDto(demandRepository.save(demand));
    }

    @Transactional
    public void deleteDemand(Long demandId, CurrentUser user) {
        requireCustomer(user);
        Demand demand = findOwnedDemand(demandId, user);
        demand.hideForCustomer();
        demandRepository.save(demand);
    }

    @Transactional(readOnly = true)
    public DemandDto getDemand(Long demandId, CurrentUser user) {
        Demand demand = findDemand(demandId);
        boolean ownerOrAdmin = isOwner(user, demand) || isAdmin(user);
        if (!demand.isModerationVisible() && !ownerOrAdmin) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "需求不存在");
        }
        if (ownerOrAdmin) {
            return toOwnerDemandDto(demand);
        }
        if (demand.getStatus() == DemandStatus.OPEN) {
            return toDemandDto(demand);
        }
        throw new BusinessException(ErrorCode.FORBIDDEN, "no permission to view this demand");
    }

    @Transactional
    public DemandResponseDto respondToDemand(Long demandId, CurrentUser user, CreateDemandResponseRequest request) {
        requireProvider(user);
        Demand demand = requirePublicInteractiveDemand(demandId);
        if (demand.getCustomerId().equals(user.getUserId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "provider cannot respond to own demand");
        }
        if (responseRepository.findByDemandIdAndProviderId(demandId, user.getUserId()).isPresent()) {
            throw new BusinessException(ErrorCode.DUPLICATE_OPERATION, "provider cannot respond to the same demand twice");
        }
        validateResponseRequest(request);
        Long providerProfileId = request.getProviderProfileId() == null
                ? user.getUserId()
                : request.getProviderProfileId();
        DemandResponse response = new DemandResponse(
                demandId,
                user.getUserId(),
                providerProfileId,
                trim(request.getMessage()),
                request.getExpectedPriceCent(),
                LocalDateTime.now()
        );
        DemandResponse savedResponse = responseRepository.save(response);
        demand.increaseResponseCount();
        demandRepository.save(demand);
        return DemandMapper.toResponseDto(savedResponse);
    }

    @Transactional(readOnly = true)
    public List<DemandResponseDto> listResponses(Long demandId, CurrentUser user) {
        Demand demand = findDemand(demandId);
        if (!user.isAdmin() && !demand.getCustomerId().equals(user.getUserId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "only demand owner can list responses");
        }
        return responseRepository.findByDemandId(demandId).stream()
                .map(DemandMapper::toResponseDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<DemandResponseDto> listMyResponses(CurrentUser user) {
        requireProvider(user);
        return responseRepository.findByProviderIdOrderByResponseTimeDesc(user.getUserId()).stream()
                .map(DemandMapper::toResponseDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<DemandResponseDto> listReceivedResponses(CurrentUser user) {
        requireCustomerOrAdmin(user);
        return demandRepository.findOwnerHistory(user.getUserId(), List.of(DemandStatus.OPEN, DemandStatus.CLOSED))
                .stream()
                .flatMap(demand -> responseRepository.findByDemandId(demand.getId()).stream())
                .filter(response -> response.getStatus() == DemandResponseStatus.PENDING_CUSTOMER_ACCEPT)
                .map(DemandMapper::toResponseDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public AcceptDemandResponseResult acceptResponse(Long demandId, Long responseId, CurrentUser user) {
        AcceptedDemandResponseSnapshot snapshot = acceptResponseAndBuildSnapshot(demandId, responseId, user);
        CreateConversationResult conversation = conversationService.createConversationWithInitialMessage(
                new CreateConversationCommand(
                        snapshot.getCustomerId(),
                        snapshot.getProviderId(),
                        user.getUserId(),
                        ConversationService.SOURCE_TYPE_DEMAND_RESPONSE,
                        snapshot.getResponseId(),
                        DEFAULT_ACCEPT_INITIAL_MESSAGE
                )
        );
        notifyResponseAccepted(snapshot);
        notifyConversationStarted(snapshot, conversation.getConversationId());
        return new AcceptDemandResponseResult(snapshot, conversation.getConversationId());
    }

    @Transactional
    public DemandResponseDto rejectResponse(Long demandId, Long responseId, CurrentUser user) {
        requireCustomer(user);
        Demand demand = findOwnedDemand(demandId, user);
        DemandResponse response = findResponse(responseId);
        if (!response.getDemandId().equals(demandId)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "response does not belong to this demand");
        }
        if (demand.getStatus() != DemandStatus.OPEN) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "only open demands can reject responses");
        }
        if (response.getStatus() == DemandResponseStatus.ACCEPTED) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "accepted response cannot be rejected");
        }
        if (response.getStatus() != DemandResponseStatus.PENDING_CUSTOMER_ACCEPT) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "only pending responses can be rejected");
        }
        response.reject(null);
        DemandResponse saved = responseRepository.save(response);
        notifyResponseRejected(saved);
        return DemandMapper.toResponseDto(saved);
    }

    @Transactional(readOnly = true)
    public AcceptedDemandResponseSnapshot getAcceptedSnapshot(Long responseId, CurrentUser user) {
        DemandResponse response = findResponse(responseId);
        Demand demand = findDemand(response.getDemandId());
        if (!response.getStatus().equals(DemandResponseStatus.ACCEPTED)) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                    "response must be accepted before conversation handoff");
        }
        if (!user.isAdmin()
                && !demand.getCustomerId().equals(user.getUserId())
                && !response.getProviderId().equals(user.getUserId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "no permission to view accepted response snapshot");
        }
        return buildSnapshot(demand, response);
    }

    private AcceptedDemandResponseSnapshot acceptResponseAndBuildSnapshot(Long demandId, Long responseId, CurrentUser user) {
        requireCustomer(user);
        Demand demand = requirePublicInteractiveDemand(demandId);
        if (!demand.getCustomerId().equals(user.getUserId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "only demand owner can accept responses");
        }
        DemandResponse response = findResponse(responseId);
        if (!response.getDemandId().equals(demandId)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "response does not belong to this demand");
        }
        if (response.getStatus() == DemandResponseStatus.ACCEPTED) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "only pending responses can be accepted");
        }
        if (demand.getStatus() != DemandStatus.OPEN) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "only open demands can accept responses");
        }
        if (response.getStatus() != DemandResponseStatus.PENDING_CUSTOMER_ACCEPT) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "only pending responses can be accepted");
        }
        response.accept();
        responseRepository.save(response);
        return buildSnapshot(demand, response);
    }

    private AcceptedDemandResponseSnapshot buildSnapshot(Demand demand, DemandResponse response) {
        return new AcceptedDemandResponseSnapshot(
                response.getId(),
                demand.getId(),
                demand.getCustomerId(),
                response.getProviderId(),
                response.getStatus().name()
        );
    }

    private DemandDto toOwnerDemandDto(Demand demand) {
        return DemandMapper.toDemandDto(
                demand,
                customerInfo(demand.getCustomerId()),
                countResponses(demand.getId(), DemandResponseStatus.PENDING_CUSTOMER_ACCEPT),
                countResponses(demand.getId(), DemandResponseStatus.ACCEPTED),
                countResponses(demand.getId(), DemandResponseStatus.REJECTED),
                null,
                new ModerationView(
                        demand.getModerationStatus(),
                        demand.getModeratedAt(),
                        demand.getModerationReason())
        );
    }

    private DemandDto toDemandDto(Demand demand) {
        return DemandMapper.toDemandDto(demand, customerInfo(demand.getCustomerId()));
    }

    private DemandDto toDemandDto(Demand demand,
                                  Recommendation recommendation,
                                  Map<Long, CustomerInfo> customers) {
        return DemandMapper.toDemandDto(
                demand,
                customers.get(demand.getCustomerId()),
                recommendation == null ? null : recommendation.limitedReasons()
        );
    }

    private Map<Long, CustomerInfo> loadCustomerInfo(Collection<Demand> demands) {
        if (demands == null || demands.isEmpty() || userRepository == null) {
            return Map.of();
        }
        Set<Long> customerIds = demands.stream()
                .map(Demand::getCustomerId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (customerIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, CustomerInfo> customers = new LinkedHashMap<>();
        userRepository.findAllById(customerIds).forEach(user -> customers.put(
                user.getId(),
                new CustomerInfo(user.getNickname(), user.getAvatarFileId())));
        return customers;
    }

    private CustomerInfo customerInfo(Long customerId) {
        if (customerId == null || userRepository == null) {
            return null;
        }
        return userRepository.findById(customerId)
                .map(user -> new CustomerInfo(user.getNickname(), user.getAvatarFileId()))
                .orElse(null);
    }

    private int countResponses(Long demandId, DemandResponseStatus status) {
        return Math.toIntExact(responseRepository.countByDemandIdAndStatus(demandId, status));
    }

    private Demand findOwnedDemand(Long demandId, CurrentUser user) {
        Demand demand = findDemand(demandId);
        if (!demand.getCustomerId().equals(user.getUserId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "only the demand owner can operate this demand");
        }
        return demand;
    }

    private Demand findDemand(Long demandId) {
        if (demandId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "demandId must not be null");
        }
        return demandRepository.findById(demandId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "demand not found"));
    }

    private Demand requirePublicInteractiveDemand(Long demandId) {
        Demand demand = findDemand(demandId);
        if (demand.getStatus() != DemandStatus.OPEN
                || !demand.isModerationVisible()
                || Boolean.TRUE.equals(demand.getHiddenByCustomer())) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "current demand is not publicly interactive");
        }
        return demand;
    }

    private boolean isOwner(CurrentUser user, Demand demand) {
        return user != null
                && user.getUserId() != null
                && demand.getCustomerId().equals(user.getUserId());
    }

    private boolean isAdmin(CurrentUser user) {
        return user != null && user.isAdmin();
    }

    private DemandResponse findResponse(Long responseId) {
        if (responseId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "responseId must not be null");
        }
        return responseRepository.findById(responseId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "response not found"));
    }

    private void requireCustomer(CurrentUser user) {
        if (!user.isCustomer()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "current operation requires customer role");
        }
    }

    private void requireCustomerOrAdmin(CurrentUser user) {
        if (user == null || (!user.isCustomer() && !user.isAdmin())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "only customer can list own demand history");
        }
    }

    private void requireProvider(CurrentUser user) {
        if (!user.isProvider()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "current operation requires provider role");
        }
    }

    private void validateDemandRequest(CreateDemandRequest request) {
        if (request == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "request must not be null");
        }
        requireText(request.getScene(), "scene must not be blank");
        requireText(request.getCityCode(), "cityCode must not be blank");
        requireText(request.getLocation(), "location must not be blank");
        requireText(request.getTimeDescription(), "timeDescription must not be blank");
        validateCent(request.getBudgetMinCent(), "budgetMinCent must not be negative");
        validateCent(request.getBudgetMaxCent(), "budgetMaxCent must not be negative");
        validateBudgetRange(request.getBudgetMinCent(), request.getBudgetMaxCent());
        normalizeTimeTags(request.getTimeTags());
    }

    private void applyUpdate(Demand demand, CreateDemandRequest request) {
        if (request.getScene() != null) {
            requireText(request.getScene(), "scene must not be blank");
            demand.setScene(trim(request.getScene()));
        }
        if (request.getStyleTags() != null) {
            demand.setStyleTags(normalizeTags(request.getStyleTags()));
        }
        if (request.getExpectedDate() != null) {
            demand.setExpectedDate(request.getExpectedDate());
        }
        if (request.getTimeSlot() != null) {
            demand.setTimeSlot(trim(request.getTimeSlot()));
        }
        if (request.getTimeDescription() != null) {
            requireText(request.getTimeDescription(), "timeDescription must not be blank");
            demand.setTimeDescription(trim(request.getTimeDescription()));
        }
        if (request.getTimeTags() != null) {
            demand.setTimeTags(normalizeTimeTags(request.getTimeTags()));
        }
        if (request.getCityCode() != null) {
            requireText(request.getCityCode(), "cityCode must not be blank");
            demand.setCityCode(trim(request.getCityCode()));
        }
        if (request.getLocation() != null) {
            requireText(request.getLocation(), "location must not be blank");
            demand.setLocation(trim(request.getLocation()));
        }
        if (request.getBudgetMinCent() != null) {
            validateCent(request.getBudgetMinCent(), "budgetMinCent must not be negative");
            demand.setBudgetMinCent(request.getBudgetMinCent());
        }
        if (request.getBudgetMaxCent() != null) {
            validateCent(request.getBudgetMaxCent(), "budgetMaxCent must not be negative");
            demand.setBudgetMaxCent(request.getBudgetMaxCent());
        }
        if (request.getDescription() != null) {
            demand.setDescription(trim(request.getDescription()));
        }
        if (request.getReferenceFileIds() != null) {
            demand.setReferenceFileIds(normalizeIds(request.getReferenceFileIds()));
        }
    }

    private void validateResponseRequest(CreateDemandResponseRequest request) {
        if (request == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "request must not be null");
        }
        requireText(request.getMessage(), "message must not be blank");
        validateCent(request.getExpectedPriceCent(), "expectedPriceCent must not be negative");
    }

    private void validateCent(Integer value, String message) {
        if (value != null && value < 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, message);
        }
    }

    private void validateBudgetRange(Integer minBudgetCent, Integer maxBudgetCent) {
        if (minBudgetCent != null && maxBudgetCent != null && maxBudgetCent < minBudgetCent) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "budgetMaxCent must not be below budgetMinCent");
        }
    }

    private boolean matchesBudget(Demand demand, Integer minBudgetCent, Integer maxBudgetCent) {
        if (minBudgetCent == null && maxBudgetCent == null) {
            return true;
        }
        Integer demandMin = demand.getBudgetMinCent();
        Integer demandMax = demand.getBudgetMaxCent();
        if (demandMin == null && demandMax == null) {
            return false;
        }
        int normalizedDemandMin = demandMin == null ? demandMax : demandMin;
        int normalizedDemandMax = demandMax == null ? demandMin : demandMax;
        if (minBudgetCent != null && normalizedDemandMax < minBudgetCent) {
            return false;
        }
        return maxBudgetCent == null || normalizedDemandMin <= maxBudgetCent;
    }

    private void requireText(String value, String message) {
        if (isBlank(value)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, message);
        }
    }

    private List<String> normalizeTags(List<String> tags) {
        if (tags == null) {
            return List.of();
        }
        return tags.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(tag -> !tag.isBlank())
                .map(tag -> tag.toLowerCase(Locale.ROOT))
                .distinct()
                .collect(Collectors.toList());
    }

    private List<Long> normalizeIds(List<Long> ids) {
        if (ids == null) {
            return List.of();
        }
        List<Long> normalized = ids.stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (normalized.size() > MAX_IMAGE_COUNT) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "最多只能上传 9 张图片");
        }
        return normalized;
    }

    private List<String> normalizeTimeTags(List<String> tags) {
        if (tags == null) {
            return List.of();
        }
        List<String> normalized = tags.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(tag -> !tag.isBlank())
                .map(tag -> tag.toUpperCase(Locale.ROOT))
                .distinct()
                .toList();
        for (String tag : normalized) {
            if (!SUPPORTED_TIME_TAGS.contains(tag)) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unsupported timeTag: " + tag);
            }
        }
        return normalized;
    }

    private String normalizeTimeTagFilter(String value) {
        if (isBlank(value)) {
            return null;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        if (!SUPPORTED_TIME_TAGS.contains(normalized)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unsupported timeTag: " + value);
        }
        return normalized;
    }

    private String normalizeTextFilter(String value) {
        if (isBlank(value)) {
            return null;
        }
        return value.trim();
    }

    private String normalizeDemandSort(String sort) {
        if ("recommend".equalsIgnoreCase(trim(sort))) {
            return "recommend";
        }
        return "latest";
    }

    private Comparator<Demand> latestDemandComparator() {
        return Comparator
                .comparing(Demand::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(Demand::getId, Comparator.nullsLast(Comparator.reverseOrder()));
    }

    private boolean matchesDemandKeyword(Demand demand,
                                         String keyword,
                                         Map<Long, CustomerInfo> customers) {
        String normalized = normalizeKeyword(keyword);
        if (normalized == null) {
            return true;
        }
        boolean demandMatched = containsKeyword(normalized,
                demand.getScene(),
                demand.getDescription(),
                demand.getLocation())
                || listContainsKeyword(demand.getStyleTags(), normalized);
        if (demandMatched) {
            return true;
        }
        CustomerInfo customerInfo = customers.get(demand.getCustomerId());
        return containsKeyword(normalized, customerInfo == null ? null : customerInfo.nickname());
    }

    private PhotographerPreference demandRecommendationPreference(CurrentUser currentUser,
                                                                  String cityCode,
                                                                  String styleTag,
                                                                  Integer minBudgetCent,
                                                                  Integer maxBudgetCent) {
        List<ServicePackage> providerPackages = currentUser == null || !currentUser.isProvider()
                ? List.of()
                : servicePackageRepository.findByStatus(ServicePackageStatus.ONLINE).stream()
                .filter(servicePackage -> Objects.equals(servicePackage.getProviderId(), currentUser.getUserId()))
                .filter(servicePackage -> !Boolean.TRUE.equals(servicePackage.getHiddenByProvider()))
                .toList();
        String preferredCity = providerPackages.stream()
                .map(ServicePackage::getCityCode)
                .filter(value -> !isBlank(value))
                .findFirst()
                .orElse(cityCode);
        Set<String> preferredStyles = providerPackages.stream()
                .flatMap(servicePackage -> servicePackage.getStyleTags().stream())
                .filter(value -> !isBlank(value))
                .map(value -> value.trim().toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());
        if (preferredStyles.isEmpty() && !isBlank(styleTag)) {
            preferredStyles = Set.of(styleTag.trim().toLowerCase(Locale.ROOT));
        }
        Integer preferredMin = providerPackages.stream()
                .map(ServicePackage::getBasePriceCent)
                .filter(Objects::nonNull)
                .map(Long::intValue)
                .min(Integer::compareTo)
                .orElse(minBudgetCent);
        Integer preferredMax = providerPackages.stream()
                .map(ServicePackage::getBasePriceCent)
                .filter(Objects::nonNull)
                .map(Long::intValue)
                .max(Integer::compareTo)
                .orElse(maxBudgetCent);
        boolean hasProfile = !isBlank(preferredCity)
                || !preferredStyles.isEmpty()
                || preferredMin != null
                || preferredMax != null;
        return new PhotographerPreference(preferredCity, preferredStyles, preferredMin, preferredMax, hasProfile);
    }

    private Recommendation scoreDemandRecommendation(Demand demand,
                                                     PhotographerPreference preference,
                                                     String timeTag,
                                                     Set<Long> respondedDemandIds,
                                                     String feedSeed) {
        int score = 0;
        List<String> reasons = new ArrayList<>();
        if (!isBlank(preference.cityCode()) && equalsIgnoreCase(demand.getCityCode(), preference.cityCode())) {
            score += 30;
            addReason(reasons, "同城匹配");
        }
        if (!preference.styleTags().isEmpty() && overlaps(demand.getStyleTags(), preference.styleTags())) {
            score += 25;
            addReason(reasons, "风格匹配");
        }
        if (budgetOverlaps(demand.getBudgetMinCent(), demand.getBudgetMaxCent(),
                preference.minPriceCent(), preference.maxPriceCent())) {
            score += 15;
            addReason(reasons, "预算合适");
        }
        if (timeTag != null && demand.getTimeTags().contains(timeTag)) {
            score += 15;
            addReason(reasons, "近期需求");
        } else if (isWithinDays(demand.getExpectedDate(), 30)) {
            score += 10;
            addReason(reasons, "近期需求");
        }
        if (demand.getResponseCount() <= 2) {
            score += 10;
            addReason(reasons, "响应较少");
        } else if (demand.getResponseCount() <= 8) {
            score += 5;
            addReason(reasons, "响应较少");
        }
        score += freshnessScore(demand.getUpdatedAt(), reasons, "近期需求");
        if (!isBlank(demand.getLocation())
                && !isBlank(demand.getDescription())
                && (demand.getBudgetMinCent() != null || demand.getBudgetMaxCent() != null)
                && demand.getReferenceFileIds() != null
                && !demand.getReferenceFileIds().isEmpty()) {
            score += 5;
            addReason(reasons, "信息完整");
        }
        if (respondedDemandIds.contains(demand.getId())) {
            score -= 100;
        }
        score += feedSeedScore(feedSeed, demand.getId());
        return new Recommendation(score, reasons);
    }

    private Set<Long> respondedDemandIds(CurrentUser currentUser, List<Demand> candidates, boolean shouldRecommend) {
        if (!shouldRecommend || currentUser == null || !currentUser.isProvider() || candidates == null || candidates.isEmpty()) {
            return Set.of();
        }
        List<Long> demandIds = candidates.stream()
                .map(Demand::getId)
                .filter(Objects::nonNull)
                .toList();
        if (demandIds.isEmpty()) {
            return Set.of();
        }
        return new HashSet<>(responseRepository.findDemandIdsByProviderIdAndDemandIdIn(currentUser.getUserId(), demandIds));
    }

    private int freshnessScore(LocalDateTime updatedAt, List<String> reasons, String reason) {
        if (updatedAt == null) {
            return 0;
        }
        long days = ChronoUnit.DAYS.between(updatedAt.toLocalDate(), LocalDate.now());
        if (days <= 3) {
            addReason(reasons, reason);
            return 10;
        }
        if (days <= 7) {
            addReason(reasons, reason);
            return 6;
        }
        if (days <= 30) {
            return 2;
        }
        return 0;
    }

    private int feedSeedScore(String feedSeed, Long id) {
        if (isBlank(feedSeed) || id == null) {
            return 0;
        }
        return Math.floorMod(Objects.hash(feedSeed, id), 11) - 5;
    }

    private List<Demand> diversifyDemands(List<Demand> sortedDemands) {
        if (sortedDemands == null || sortedDemands.size() < 3) {
            return sortedDemands;
        }
        List<Demand> pool = new ArrayList<>(sortedDemands);
        List<Demand> result = new ArrayList<>(sortedDemands.size());
        while (!pool.isEmpty()) {
            int selectedIndex = 0;
            int window = Math.min(pool.size(), 8);
            for (int i = 0; i < window; i++) {
                if (!isTooSimilarDemand(pool.get(i), result)) {
                    selectedIndex = i;
                    break;
                }
            }
            result.add(pool.remove(selectedIndex));
        }
        return result;
    }

    private boolean isTooSimilarDemand(Demand candidate, List<Demand> result) {
        if (candidate == null || result.size() < 2) {
            return false;
        }
        Demand first = result.get(result.size() - 1);
        Demand second = result.get(result.size() - 2);
        boolean sameCity = equalsIgnoreCase(candidate.getCityCode(), first.getCityCode())
                && equalsIgnoreCase(candidate.getCityCode(), second.getCityCode());
        boolean sameStyle = sharesAnyStyle(candidate.getStyleTags(), first.getStyleTags())
                && sharesAnyStyle(candidate.getStyleTags(), second.getStyleTags());
        return sameCity || sameStyle;
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

    private boolean isWithinDays(LocalDate date, int days) {
        if (date == null) {
            return false;
        }
        LocalDate today = LocalDate.now();
        return !date.isBefore(today) && !date.isAfter(today.plusDays(days));
    }

    private boolean budgetOverlaps(Integer leftMin, Integer leftMax, Integer rightMin, Integer rightMax) {
        if (rightMin == null && rightMax == null) {
            return false;
        }
        if (leftMin == null && leftMax == null) {
            return false;
        }
        int normalizedLeftMin = leftMin == null ? leftMax : leftMin;
        int normalizedLeftMax = leftMax == null ? leftMin : leftMax;
        int normalizedRightMin = rightMin == null ? rightMax : rightMin;
        int normalizedRightMax = rightMax == null ? rightMin : rightMax;
        return normalizedLeftMax >= normalizedRightMin && normalizedLeftMin <= normalizedRightMax;
    }

    private boolean overlaps(List<String> values, Set<String> targets) {
        if (values == null || values.isEmpty() || targets == null || targets.isEmpty()) {
            return false;
        }
        return values.stream()
                .filter(Objects::nonNull)
                .map(value -> value.trim().toLowerCase(Locale.ROOT))
                .anyMatch(targets::contains);
    }

    private void addReason(List<String> reasons, String reason) {
        if (reasons.size() < 3 && !reasons.contains(reason)) {
            reasons.add(reason);
        }
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

    private DemandStatus resolvePublicStatusFilter(String status) {
        if (isBlank(status) || DemandStatus.OPEN.name().equalsIgnoreCase(status.trim())) {
            return DemandStatus.OPEN;
        }
        return null;
    }

    private String trim(String value) {
        return value == null ? null : value.trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private record PhotographerPreference(String cityCode,
                                          Set<String> styleTags,
                                          Integer minPriceCent,
                                          Integer maxPriceCent,
                                          boolean hasProfile) {
    }

    private record Recommendation(int score, List<String> reasons) {
        private List<String> limitedReasons() {
            if (reasons == null || reasons.isEmpty()) {
                return List.of();
            }
            return reasons.stream().limit(3).toList();
        }
    }

    private void notifyResponseAccepted(AcceptedDemandResponseSnapshot snapshot) {
        notificationService.createNotification(new NotificationCreateRequest(
                snapshot.getProviderId(),
                snapshot.getCustomerId(),
                "约拍响应已接受",
                "你的约拍响应已被接受。",
                "DEMAND_RESPONSE_ACCEPTED",
                "DEMAND_RESPONSE",
                "DEMAND_RESPONSE",
                snapshot.getResponseId(),
                "DEMAND_RESPONSE",
                snapshot.getResponseId(),
                "DEMAND_RESPONSE",
                snapshot.getResponseId(),
                "demand:response:accepted:" + snapshot.getResponseId(),
                String.format("{\"demandId\":%d,\"responseId\":%d}", snapshot.getDemandId(), snapshot.getResponseId())
        ));
    }

    private void notifyResponseRejected(DemandResponse response) {
        notificationService.createNotification(new NotificationCreateRequest(
                response.getProviderId(),
                null,
                "约拍响应已拒绝",
                "你的约拍响应已被拒绝。",
                "DEMAND_RESPONSE_REJECTED",
                "DEMAND_RESPONSE",
                "DEMAND_RESPONSE",
                response.getId(),
                "DEMAND_RESPONSE",
                response.getId(),
                "DEMAND_RESPONSE",
                response.getId(),
                "demand:response:rejected:" + response.getId(),
                String.format("{\"demandId\":%d,\"responseId\":%d}", response.getDemandId(), response.getId())
        ));
    }

    private void notifyConversationStarted(AcceptedDemandResponseSnapshot snapshot, Long conversationId) {
        notificationService.createNotification(new NotificationCreateRequest(
                snapshot.getProviderId(),
                snapshot.getCustomerId(),
                "约拍会话已开启",
                "你的约拍响应已开启会话。",
                "CONVERSATION_STARTED",
                "CONVERSATION",
                "CONVERSATION",
                conversationId,
                "CONVERSATION",
                conversationId,
                "CONVERSATION",
                conversationId,
                "demand:conversation:" + conversationId,
                String.format("{\"demandId\":%d,\"responseId\":%d,\"conversationId\":%d}", snapshot.getDemandId(), snapshot.getResponseId(), conversationId)
        ));
    }
}
