package com.action.camera.demand.service;

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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class DemandService {

    private static final int DEFAULT_EXPIRE_DAYS = 30;
    private static final String DEFAULT_ACCEPT_INITIAL_MESSAGE = "Demand response accepted; conversation opened.";
    private static final Set<String> SUPPORTED_TIME_TAGS = Set.of(
            "NEAR_3_DAYS",
            "NEAR_7_DAYS",
            "NEAR_1_MONTH"
    );

    private final DemandRepository demandRepository;
    private final DemandResponseRepository responseRepository;
    private final ConversationService conversationService;

    public DemandService(DemandRepository demandRepository,
                         DemandResponseRepository responseRepository,
                         ConversationService conversationService) {
        this.demandRepository = demandRepository;
        this.responseRepository = responseRepository;
        this.conversationService = conversationService;
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
                request.getReferenceFileIds(),
                now,
                now.plusDays(DEFAULT_EXPIRE_DAYS)
        );
        Demand savedDemand = demandRepository.save(demand);
        return DemandMapper.toDemandDto(savedDemand);
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
        int safePage = Math.max(page, 1);
        int safeSize = Math.max(1, Math.min(size, 50));
        String normalizedTag = isBlank(styleTag) ? null : styleTag.trim().toLowerCase(Locale.ROOT);
        String normalizedTimeTag = normalizeTimeTagFilter(timeTag);
        DemandStatus publicStatus = resolvePublicStatusFilter(status);
        if (publicStatus == null) {
            return new PageResult<>(List.of(), safePage, safeSize, 0);
        }
        List<DemandDto> filtered = demandRepository.findAll().stream()
                .filter(demand -> isBlank(cityCode) || demand.getCityCode().equalsIgnoreCase(cityCode.trim()))
                .filter(demand -> isBlank(scene) || demand.getScene().equalsIgnoreCase(scene.trim()))
                .filter(demand -> demand.getStatus() == publicStatus)
                .filter(demand -> expectedDate == null || expectedDate.equals(demand.getExpectedDate()))
                .filter(demand -> normalizedTag == null || demand.getStyleTags().contains(normalizedTag))
                .filter(demand -> normalizedTimeTag == null || demand.getTimeTags().contains(normalizedTimeTag))
                .filter(demand -> matchesBudget(demand, minBudgetCent, maxBudgetCent))
                .sorted(Comparator.comparing(Demand::getUpdatedAt,
                        Comparator.nullsFirst(Comparator.naturalOrder())).reversed())
                .map(DemandMapper::toDemandDto)
                .collect(Collectors.toList());
        int fromIndex = Math.min((safePage - 1) * safeSize, filtered.size());
        int toIndex = Math.min(fromIndex + safeSize, filtered.size());
        return new PageResult<>(filtered.subList(fromIndex, toIndex), safePage, safeSize, filtered.size());
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
        return DemandMapper.toDemandDto(demandRepository.save(demand));
    }

    @Transactional
    public DemandDto closeDemand(Long demandId, CurrentUser user) {
        requireCustomer(user);
        Demand demand = findOwnedDemand(demandId, user);
        demand.close();
        return DemandMapper.toDemandDto(demandRepository.save(demand));
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
        if (demand.getStatus() == DemandStatus.OPEN
                || (user != null && (user.isAdmin() || demand.getCustomerId().equals(user.getUserId())))) {
            return DemandMapper.toDemandDto(demand);
        }
        throw new BusinessException(ErrorCode.FORBIDDEN, "no permission to view this demand");
    }

    @Transactional
    public DemandResponseDto respondToDemand(Long demandId, CurrentUser user, CreateDemandResponseRequest request) {
        requireProvider(user);
        Demand demand = findDemand(demandId);
        if (!demand.getStatus().equals(DemandStatus.OPEN)) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "only open demands can be responded");
        }
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
        return DemandMapper.toResponseDto(responseRepository.save(response));
    }

    @Transactional(readOnly = true)
    public AcceptedDemandResponseSnapshot getAcceptedSnapshot(Long responseId, CurrentUser user) {
        DemandResponse response = findResponse(responseId);
        Demand demand = findDemand(response.getDemandId());
        if (!response.getStatus().equals(DemandResponseStatus.ACCEPTED)) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "鍝嶅簲灏氭湭琚帴鍙楋紝涓嶈兘浜ょ粰 C 鍒涘缓浼氳瘽");
        }
        if (!user.isAdmin()
                && !demand.getCustomerId().equals(user.getUserId())
                && !response.getProviderId().equals(user.getUserId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "鏃犳潈闄愭煡鐪嬪凡鎺ュ彈鍝嶅簲蹇収");
        }
        return buildSnapshot(demand, response);
    }

    private AcceptedDemandResponseSnapshot acceptResponseAndBuildSnapshot(Long demandId, Long responseId, CurrentUser user) {
        requireCustomer(user);
        Demand demand = findDemand(demandId);
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
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "鍙湁寰呴渶姹傛柟鎺ュ彈鐨勫搷搴斿彲浠ヨ鎺ュ彈");
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

    private Demand findOwnedDemand(Long demandId, CurrentUser user) {
        Demand demand = findDemand(demandId);
        if (!demand.getCustomerId().equals(user.getUserId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "only the demand owner can operate this demand");
        }
        return demand;
    }

    private Demand findDemand(Long demandId) {
        if (demandId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "demandId 涓嶈兘涓虹┖");
        }
        return demandRepository.findById(demandId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "闇€姹備笉瀛樺湪"));
    }

    private DemandResponse findResponse(Long responseId) {
        if (responseId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "responseId 涓嶈兘涓虹┖");
        }
        return responseRepository.findById(responseId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "response not found"));
    }

    private void requireCustomer(CurrentUser user) {
        if (!user.isCustomer()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "褰撳墠鎿嶄綔闇€瑕侀渶姹傛柟韬唤");
        }
    }

    private void requireProvider(CurrentUser user) {
        if (!user.isProvider()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "褰撳墠鎿嶄綔闇€瑕佹湇鍔℃柟韬唤");
        }
    }

    private void validateDemandRequest(CreateDemandRequest request) {
        if (request == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "request must not be null");
        }
        requireText(request.getScene(), "鎷嶆憚鍦烘櫙涓嶈兘涓虹┖");
        requireText(request.getCityCode(), "鍩庡競涓嶈兘涓虹┖");
        requireText(request.getLocation(), "鎷嶆憚鍦扮偣涓嶈兘涓虹┖");
        requireText(request.getTimeDescription(), "timeDescription must not be blank");
        validateCent(request.getBudgetMinCent(), "鏈€浣庨绠椾笉鑳戒负璐熸暟");
        validateCent(request.getBudgetMaxCent(), "鏈€楂橀绠椾笉鑳戒负璐熸暟");
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
            demand.setReferenceFileIds(request.getReferenceFileIds());
        }
    }

    private void validateResponseRequest(CreateDemandResponseRequest request) {
        if (request == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "request must not be null");
        }
        requireText(request.getMessage(), "鍝嶅簲璇存槑涓嶈兘涓虹┖");
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
}
