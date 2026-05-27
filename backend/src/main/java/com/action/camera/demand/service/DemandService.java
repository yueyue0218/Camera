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
import com.action.camera.demand.dto.CreateDemandInvitationRequest;
import com.action.camera.demand.dto.CreateDemandRequest;
import com.action.camera.demand.dto.CreateDemandResponseRequest;
import com.action.camera.demand.dto.DemandDto;
import com.action.camera.demand.dto.DemandInvitationDto;
import com.action.camera.demand.dto.DemandResponseDto;
import com.action.camera.demand.repository.DemandRepository;
import com.action.camera.demand.repository.DemandResponseRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

@Service
public class DemandService {

    private static final int DEFAULT_EXPIRE_DAYS = 30;
    private static final String INVITATION_ACCEPTED = "ACCEPTED";
    private static final String INVITATION_REJECTED = "REJECTED";

    private final DemandRepository demandRepository;
    private final DemandResponseRepository responseRepository;
    private final AtomicLong invitationIdGenerator = new AtomicLong(7000);
    private final ConcurrentMap<Long, DemandInvitationDto> invitations = new ConcurrentHashMap<>();

    public DemandService(DemandRepository demandRepository, DemandResponseRepository responseRepository) {
        this.demandRepository = demandRepository;
        this.responseRepository = responseRepository;
    }

    public DemandDto createDemand(CurrentUser user, CreateDemandRequest request) {
        requireCustomer(user);
        validateDemandRequest(request);
        LocalDateTime now = LocalDateTime.now();
        Demand demand = new Demand(
                demandRepository.nextId(),
                user.getUserId(),
                trim(request.getScene()),
                normalizeTags(request.getStyleTags()),
                request.getExpectedDate(),
                trim(request.getTimeSlot()),
                trim(request.getCityCode()),
                trim(request.getLocation()),
                request.getBudgetMinCent(),
                request.getBudgetMaxCent(),
                trim(request.getDescription()),
                request.getReferenceFileIds(),
                now,
                now.plusDays(DEFAULT_EXPIRE_DAYS)
        );
        demandRepository.save(demand);
        return DemandMapper.toDemandDto(demand);
    }

    public PageResult<DemandDto> listDemands(int page, int size, String cityCode, String scene, String status) {
        return listDemands(page, size, cityCode, scene, status, null, null, null, null);
    }

    public PageResult<DemandDto> listDemands(int page,
                                             int size,
                                             String cityCode,
                                             String scene,
                                             String status,
                                             LocalDate expectedDate,
                                             String styleTag,
                                             Integer minBudgetCent,
                                             Integer maxBudgetCent) {
        int safePage = Math.max(page, 1);
        int safeSize = Math.max(1, Math.min(size, 50));
        String normalizedTag = isBlank(styleTag) ? null : styleTag.trim().toLowerCase(Locale.ROOT);
        List<DemandDto> filtered = demandRepository.findAll().stream()
                .filter(demand -> isBlank(cityCode) || demand.getCityCode().equalsIgnoreCase(cityCode.trim()))
                .filter(demand -> isBlank(scene) || demand.getScene().equalsIgnoreCase(scene.trim()))
                .filter(demand -> isBlank(status) || demand.getStatus().name().equalsIgnoreCase(status.trim()))
                .filter(demand -> expectedDate == null || expectedDate.equals(demand.getExpectedDate()))
                .filter(demand -> normalizedTag == null || demand.getStyleTags().contains(normalizedTag))
                .filter(demand -> matchesBudget(demand, minBudgetCent, maxBudgetCent))
                .sorted(Comparator.comparing(Demand::getCreatedAt).reversed())
                .map(DemandMapper::toDemandDto)
                .collect(Collectors.toList());
        int fromIndex = Math.min((safePage - 1) * safeSize, filtered.size());
        int toIndex = Math.min(fromIndex + safeSize, filtered.size());
        return new PageResult<>(filtered.subList(fromIndex, toIndex), safePage, safeSize, filtered.size());
    }

    public void deleteDemand(Long demandId, CurrentUser user) {
        Demand demand = findDemand(demandId);
        if (!user.isAdmin() && !demand.getCustomerId().equals(user.getUserId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "only the demand owner can delete this demand");
        }
        if (demand.getStatus() == DemandStatus.MATCHED) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "transaction in progress, demand cannot be deleted");
        }
        demandRepository.deleteById(demandId);
    }

    public DemandDto getDemand(Long demandId, CurrentUser user) {
        Demand demand = findDemand(demandId);
        if (user.isAdmin() || demand.getCustomerId().equals(user.getUserId())
                || demand.getStatus() == DemandStatus.OPEN) {
            return DemandMapper.toDemandDto(demand);
        }
        throw new BusinessException(ErrorCode.FORBIDDEN, "无权限查看该需求");
    }

    public DemandResponseDto respondToDemand(Long demandId, CurrentUser user, CreateDemandResponseRequest request) {
        requireProvider(user);
        Demand demand = findDemand(demandId);
        if (!demand.getStatus().equals(DemandStatus.OPEN)) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "只有开放中的需求可以响应");
        }
        if (demand.getCustomerId().equals(user.getUserId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "不能响应自己发布的需求");
        }
        if (responseRepository.findByDemandIdAndProviderId(demandId, user.getUserId()).isPresent()) {
            throw new BusinessException(ErrorCode.DUPLICATE_OPERATION, "同一服务方不能重复响应同一需求");
        }
        validateResponseRequest(request);
        Long providerProfileId = request.getProviderProfileId() == null
                ? user.getUserId()
                : request.getProviderProfileId();
        DemandResponse response = new DemandResponse(
                responseRepository.nextId(),
                demandId,
                user.getUserId(),
                providerProfileId,
                trim(request.getMessage()),
                request.getExpectedPriceCent(),
                LocalDateTime.now()
        );
        responseRepository.save(response);
        demand.increaseResponseCount();
        demandRepository.save(demand);
        return DemandMapper.toResponseDto(response);
    }

    public List<DemandResponseDto> listResponses(Long demandId, CurrentUser user) {
        Demand demand = findDemand(demandId);
        if (!user.isAdmin() && !demand.getCustomerId().equals(user.getUserId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有需求发布者可以查看响应列表");
        }
        return responseRepository.findByDemandId(demandId).stream()
                .map(DemandMapper::toResponseDto)
                .collect(Collectors.toList());
    }

    public AcceptDemandResponseResult acceptResponse(Long demandId, Long responseId, CurrentUser user) {
        return new AcceptDemandResponseResult(acceptResponseAndBuildSnapshot(demandId, responseId, user));
    }

    public DemandInvitationDto createInvitation(Long demandId, CurrentUser user, CreateDemandInvitationRequest request) {
        requireProvider(user);
        Demand demand = findDemand(demandId);
        if (demand.getCustomerId().equals(user.getUserId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "不能向自己发布的需求发起邀请");
        }
        if (demand.getStatus() != DemandStatus.OPEN) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "只有开放中的需求可以发起邀请");
        }
        if (request == null || isBlank(request.getMessage())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "邀请说明不能为空");
        }
        validateCent(request.getExpectedPriceCent(), "邀请报价不能为负数");
        boolean duplicated = invitations.values().stream()
                .anyMatch(invitation -> invitation.getDemandId().equals(demandId)
                        && invitation.getProviderId().equals(user.getUserId()));
        if (duplicated) {
            throw new BusinessException(ErrorCode.DUPLICATE_OPERATION, "同一服务方不能重复邀请同一需求");
        }
        DemandInvitationDto invitation = new DemandInvitationDto(
                invitationIdGenerator.incrementAndGet(),
                demand.getId(),
                demand.getCustomerId(),
                user.getUserId(),
                demand.getScene(),
                trim(request.getMessage()),
                request.getExpectedPriceCent(),
                LocalDateTime.now()
        );
        invitations.put(invitation.getInvitationId(), invitation);
        return invitation;
    }

    public List<DemandInvitationDto> listReceivedInvitations(CurrentUser user) {
        requireCustomer(user);
        return invitations.values().stream()
                .filter(invitation -> invitation.getCustomerId().equals(user.getUserId()))
                .sorted(Comparator.comparing(DemandInvitationDto::getCreatedAt).reversed())
                .collect(Collectors.toList());
    }

    public List<DemandInvitationDto> listSentInvitations(CurrentUser user) {
        requireProvider(user);
        return invitations.values().stream()
                .filter(invitation -> invitation.getProviderId().equals(user.getUserId()))
                .sorted(Comparator.comparing(DemandInvitationDto::getCreatedAt).reversed())
                .collect(Collectors.toList());
    }

    public AcceptDemandResponseResult acceptInvitation(Long invitationId, CurrentUser user) {
        requireCustomer(user);
        DemandInvitationDto invitation = findInvitation(invitationId);
        ensureInvitationOwner(invitation, user);

        if (INVITATION_REJECTED.equals(invitation.getStatus())) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "该邀请已被暂不接受，不能再次接受");
        }
        if (INVITATION_ACCEPTED.equals(invitation.getStatus()) && invitation.getResponseId() != null) {
            return new AcceptDemandResponseResult(getAcceptedSnapshot(invitation.getResponseId(), user));
        }

        Demand demand = findDemand(invitation.getDemandId());
        if (!demand.getCustomerId().equals(user.getUserId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有需求发布者可以接受邀请");
        }
        DemandResponse response = responseRepository
                .findByDemandIdAndProviderId(invitation.getDemandId(), invitation.getProviderId())
                .orElseGet(() -> createResponseFromInvitation(invitation, demand));

        AcceptedDemandResponseSnapshot snapshot =
                acceptResponseAndBuildSnapshot(invitation.getDemandId(), response.getId(), user);
        invitations.put(invitationId, invitation.accepted(snapshot.getResponseId(), LocalDateTime.now()));
        return new AcceptDemandResponseResult(snapshot);
    }

    public DemandInvitationDto rejectInvitation(Long invitationId, CurrentUser user) {
        requireCustomer(user);
        DemandInvitationDto invitation = findInvitation(invitationId);
        ensureInvitationOwner(invitation, user);

        if (INVITATION_ACCEPTED.equals(invitation.getStatus())) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "该邀请已接受，不能再暂不接受");
        }
        if (INVITATION_REJECTED.equals(invitation.getStatus())) {
            return invitation;
        }
        DemandInvitationDto rejected = invitation.rejected(LocalDateTime.now());
        invitations.put(invitationId, rejected);
        return rejected;
    }

    public AcceptedDemandResponseSnapshot getAcceptedSnapshot(Long responseId, CurrentUser user) {
        DemandResponse response = findResponse(responseId);
        Demand demand = findDemand(response.getDemandId());
        if (!response.getStatus().equals(DemandResponseStatus.ACCEPTED)) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "响应尚未被接受，不能交给 C 创建会话");
        }
        if (!user.isAdmin()
                && !demand.getCustomerId().equals(user.getUserId())
                && !response.getProviderId().equals(user.getUserId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "无权限查看已接受响应快照");
        }
        return buildSnapshot(demand, response);
    }

    private AcceptedDemandResponseSnapshot acceptResponseAndBuildSnapshot(Long demandId, Long responseId, CurrentUser user) {
        requireCustomer(user);
        Demand demand = findDemand(demandId);
        if (!demand.getCustomerId().equals(user.getUserId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有需求发布者可以接受响应");
        }
        DemandResponse response = findResponse(responseId);
        if (!response.getDemandId().equals(demandId)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "响应不属于该需求");
        }
        if (response.getStatus() == DemandResponseStatus.ACCEPTED) {
            return buildSnapshot(demand, response);
        }
        if (demand.getStatus() == DemandStatus.MATCHED) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "该需求已经接受过其他响应");
        }
        if (demand.getStatus() != DemandStatus.OPEN) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "只有开放中的需求可以接受响应");
        }
        if (response.getStatus() != DemandResponseStatus.PENDING_CUSTOMER_ACCEPT) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "只有待需求方接受的响应可以被接受");
        }
        response.accept();
        responseRepository.save(response);
        responseRepository.findByDemandId(demandId).stream()
                .filter(other -> !other.getId().equals(responseId))
                .filter(other -> other.getStatus() == DemandResponseStatus.PENDING_CUSTOMER_ACCEPT)
                .forEach(other -> {
                    other.reject("需求方已选择其他服务方");
                    responseRepository.save(other);
                });
        demand.markMatched();
        demandRepository.save(demand);
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

    private Demand findDemand(Long demandId) {
        if (demandId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "demandId 不能为空");
        }
        return demandRepository.findById(demandId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "需求不存在"));
    }

    private DemandInvitationDto findInvitation(Long invitationId) {
        if (invitationId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "invitationId 不能为空");
        }
        DemandInvitationDto invitation = invitations.get(invitationId);
        if (invitation == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "邀请不存在");
        }
        return invitation;
    }

    private void ensureInvitationOwner(DemandInvitationDto invitation, CurrentUser user) {
        if (!invitation.getCustomerId().equals(user.getUserId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有收到邀请的需求方可以处理邀请");
        }
    }

    private DemandResponse createResponseFromInvitation(DemandInvitationDto invitation, Demand demand) {
        DemandResponse response = new DemandResponse(
                responseRepository.nextId(),
                invitation.getDemandId(),
                invitation.getProviderId(),
                invitation.getProviderId(),
                trim(invitation.getMessage()),
                invitation.getExpectedPriceCent(),
                LocalDateTime.now()
        );
        responseRepository.save(response);
        demand.increaseResponseCount();
        demandRepository.save(demand);
        return response;
    }

    private DemandResponse findResponse(Long responseId) {
        if (responseId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "responseId 不能为空");
        }
        return responseRepository.findById(responseId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "响应不存在"));
    }

    private void requireCustomer(CurrentUser user) {
        if (!user.isCustomer()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "当前操作需要需求方身份");
        }
    }

    private void requireProvider(CurrentUser user) {
        if (!user.isProvider()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "当前操作需要服务方身份");
        }
    }

    private void validateDemandRequest(CreateDemandRequest request) {
        if (request == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "请求体不能为空");
        }
        requireText(request.getScene(), "拍摄场景不能为空");
        requireText(request.getCityCode(), "城市不能为空");
        requireText(request.getLocation(), "拍摄地点不能为空");
        validateCent(request.getBudgetMinCent(), "最低预算不能为负数");
        validateCent(request.getBudgetMaxCent(), "最高预算不能为负数");
        if (request.getBudgetMinCent() != null && request.getBudgetMaxCent() != null
                && request.getBudgetMaxCent() < request.getBudgetMinCent()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "最高预算不能低于最低预算");
        }
    }

    private void validateResponseRequest(CreateDemandResponseRequest request) {
        if (request == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "请求体不能为空");
        }
        requireText(request.getMessage(), "响应说明不能为空");
        validateCent(request.getExpectedPriceCent(), "预期报价不能为负数");
    }

    private void validateCent(Integer value, String message) {
        if (value != null && value < 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, message);
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

    private String trim(String value) {
        return value == null ? null : value.trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
