package com.action.camera.demand.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.page.PageResult;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.demand.domain.Demand;
import com.action.camera.demand.domain.DemandStatus;
import com.action.camera.demand.dto.DemandInterestDto;
import com.action.camera.demand.repository.DemandRepository;
import com.action.camera.repository.UserRepository;
import com.action.camera.servicepackage.domain.ServicePackageInterest;
import com.action.camera.servicepackage.repository.ServicePackageInterestRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class DemandInterestService {
    private static final String TARGET = "DEMAND";
    private final ServicePackageInterestRepository interests;
    private final DemandRepository demands;
    private final UserRepository users;

    public DemandInterestService(ServicePackageInterestRepository interests, DemandRepository demands, UserRepository users) {
        this.interests = interests;
        this.demands = demands;
        this.users = users;
    }

    @Transactional
    public DemandInterestDto add(Long demandId, CurrentUser user) {
        requireProvider(user);
        // Serialise add/remove per account across devices. The database unique key is the final safeguard.
        users.findByIdForUpdate(user.getUserId()).filter(u -> "ACTIVE".equals(u.getStatus()))
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
        Demand demand = demands.findByIdForUpdate(demandId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        if (!visible(demand)) { throw new BusinessException(ErrorCode.NOT_FOUND); }
        var existing = interests.findByUserIdAndDemandIdAndTargetType(user.getUserId(), demandId, TARGET);
        // Repeating an already successful add is idempotent, including after a demand is closed.
        if (existing.isPresent()) { return dto(existing.get(), demand); }
        if (Objects.equals(demand.getCustomerId(), user.getUserId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "不能将本人的需求加入意向");
        }
        if (demand.getStatus() != DemandStatus.OPEN ||
                (demand.getExpireTime() != null && !demand.getExpireTime().isAfter(LocalDateTime.now()))) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "需求已关闭或过期");
        }
        var record = new ServicePackageInterest();
        record.setUserId(user.getUserId()); record.setDemandId(demandId); record.setTargetType(TARGET);
        return dto(interests.saveAndFlush(record), demand);
    }

    @Transactional
    public void remove(Long demandId, CurrentUser user) {
        requireProvider(user);
        users.findByIdForUpdate(user.getUserId()).filter(u -> "ACTIVE".equals(u.getStatus()))
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
        // Remains possible for hidden/deleted targets; no content is read or exposed.
        interests.deleteByUserIdAndDemandIdAndTargetType(user.getUserId(), demandId, TARGET);
    }

    @Transactional(readOnly = true)
    public DemandInterestDto state(Long demandId, CurrentUser user) {
        requireProvider(user);
        var record = interests.findByUserIdAndDemandIdAndTargetType(user.getUserId(), demandId, TARGET);
        Demand demand = demands.findById(demandId).orElse(null);
        if (record.isPresent()) { return dto(record.get(), demand); }
        if (!visible(demand) || demand.getStatus() != DemandStatus.OPEN) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        return new DemandInterestDto(null, demandId, TARGET, false, demand.getStatus().name(), null, null);
    }

    @Transactional(readOnly = true)
    public PageResult<DemandInterestDto> list(CurrentUser user, int page, int size) {
        requireProvider(user);
        int safePage = Math.max(1, page), safeSize = Math.max(1, Math.min(size, 100));
        var records = interests.findByUserIdAndTargetTypeOrderByCreatedAtDescIdDesc(
                user.getUserId(), TARGET, PageRequest.of(safePage - 1, safeSize));
        Map<Long, Demand> targets = demands.findAllById(records.getContent().stream()
                .map(ServicePackageInterest::getDemandId).filter(Objects::nonNull).toList()).stream()
                .collect(Collectors.toMap(Demand::getId, Function.identity()));
        return new PageResult<>(records.getContent().stream().map(i -> dto(i, targets.get(i.getDemandId()))).toList(),
                safePage, safeSize, records.getTotalElements());
    }

    private DemandInterestDto dto(ServicePackageInterest record, Demand demand) {
        boolean available = visible(demand);
        var owner = available ? users.findById(demand.getCustomerId()).orElse(null) : null;
        var detail = available ? DemandMapper.toDemandDto(demand,
                owner == null ? null : new CustomerInfo(owner.getNickname(), owner.getAvatarFileId())) : null;
        return new DemandInterestDto(record.getId(), record.getDemandId(), TARGET, true,
                available ? demand.getStatus().name() : "UNAVAILABLE", detail, record.getCreatedAt());
    }

    private boolean visible(Demand demand) {
        return demand != null && demand.isModerationVisible() && !Boolean.TRUE.equals(demand.getHiddenByCustomer());
    }

    private void requireProvider(CurrentUser user) {
        if (user == null || user.getUserId() == null) { throw new BusinessException(ErrorCode.UNAUTHORIZED); }
        if (!user.isProvider()) { throw new BusinessException(ErrorCode.FORBIDDEN); }
    }
}
