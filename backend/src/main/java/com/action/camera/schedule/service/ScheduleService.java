package com.action.camera.schedule.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.common.security.UserRole;
import com.action.camera.order.entity.Order;
import com.action.camera.order.event.OrderCancelledEvent;
import com.action.camera.order.event.OrderPaidEvent;
import com.action.camera.schedule.dto.PublicScheduleResponse;
import com.action.camera.schedule.dto.ScheduleCreateRequest;
import com.action.camera.schedule.dto.ScheduleResponse;
import com.action.camera.schedule.dto.ScheduleUpdateRequest;
import com.action.camera.schedule.entity.Schedule;
import com.action.camera.schedule.enums.ScheduleStatus;
import com.action.camera.schedule.repository.ScheduleRepository;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

@Service
public class ScheduleService {

    private final ScheduleRepository scheduleRepository;

    public ScheduleService(ScheduleRepository scheduleRepository) {
        this.scheduleRepository = scheduleRepository;
    }

    @Transactional
    public ScheduleResponse createSchedule(CurrentUser currentUser, ScheduleCreateRequest request) {
        ensureProvider(currentUser);
        validateCreateRequest(request);

        Schedule schedule = new Schedule();
        schedule.setProviderUserId(currentUser.getUserId());
        schedule.setCityCode(request.cityCode().trim());
        schedule.setLocationHint(normalize(request.locationHint()));
        schedule.setStartTime(request.startTime());
        schedule.setEndTime(request.endTime());
        schedule.setScheduleDate(request.startTime().toLocalDate());
        schedule.setTimeSlot(normalize(request.timeSlot()));
        schedule.setPrivateRemark(normalize(request.remark()));
        schedule.setStatus(ScheduleStatus.AVAILABLE);
        ensureNoOverlappingActiveSchedule(schedule, null);

        return ScheduleResponse.from(scheduleRepository.save(schedule));
    }

    @Transactional(readOnly = true)
    public List<ScheduleResponse> listMine(CurrentUser currentUser) {
        ensureProvider(currentUser);
        return scheduleRepository.findByProviderUserIdOrderByStartTimeAsc(currentUser.getUserId())
                .stream()
                .map(ScheduleResponse::from)
                .toList();
    }

    @Transactional
    public ScheduleResponse updateSchedule(CurrentUser currentUser, Long scheduleId, ScheduleUpdateRequest request) {
        ensureProvider(currentUser);
        Schedule schedule = getOwnedSchedule(scheduleId, currentUser.getUserId());

        if (schedule.getStatus() == ScheduleStatus.BOOKED) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "Booked schedule cannot be edited");
        }
        validateUpdateRequest(request);
        schedule.setCityCode(request.cityCode().trim());
        schedule.setLocationHint(normalize(request.locationHint()));
        schedule.setStartTime(request.startTime());
        schedule.setEndTime(request.endTime());
        schedule.setScheduleDate(request.startTime().toLocalDate());
        schedule.setTimeSlot(normalize(request.timeSlot()));
        schedule.setPrivateRemark(normalize(request.remark()));
        schedule.setStatus(request.status() == null ? ScheduleStatus.AVAILABLE : request.status());
        if (schedule.getStatus() == ScheduleStatus.BOOKED) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "Provider cannot manually mark a schedule booked");
        }
        ensureNoOverlappingActiveSchedule(schedule, schedule.getId());

        return ScheduleResponse.from(scheduleRepository.save(schedule));
    }

    @Transactional
    public void deleteSchedule(CurrentUser currentUser, Long scheduleId) {
        ensureProvider(currentUser);
        Schedule schedule = getOwnedSchedule(scheduleId, currentUser.getUserId());
        if (schedule.getStatus() == ScheduleStatus.BOOKED) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "Booked schedule cannot be deleted");
        }
        scheduleRepository.delete(schedule);
    }

    @Transactional(readOnly = true)
    public List<PublicScheduleResponse> listPublicAvailable(Long providerUserId,
                                                            String cityCode,
                                                            LocalDate startDate,
                                                            LocalDate endDate) {
        if (providerUserId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "providerUserId must not be null");
        }
        LocalDate start = startDate == null ? LocalDate.now() : startDate;
        LocalDate end = endDate == null ? start.plusDays(30) : endDate;
        if (end.isBefore(start)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "endDate must not be before startDate");
        }

        return scheduleRepository.findPublicAvailableSchedules(
                        providerUserId,
                        normalize(cityCode),
                        start.atStartOfDay(),
                        end.plusDays(1).atStartOfDay())
                .stream()
                .map(PublicScheduleResponse::from)
                .toList();
    }

    @EventListener
    @Transactional
    public void handleOrderPaid(OrderPaidEvent event) {
        lockForPaidOrder(event.order());
    }

    @EventListener
    @Transactional
    public void handleOrderCancelled(OrderCancelledEvent event) {
        releaseForCancelledOrder(event.order());
    }

    public void lockForPaidOrder(Order order) {
        if (order == null || order.getId() == null) {
            return;
        }
        List<Schedule> bookedOverlaps = scheduleRepository.findOverlappingSchedules(
                order.getProviderUserId(),
                ScheduleStatus.BOOKED,
                order.getShootStartTime(),
                order.getShootEndTime(),
                null);
        boolean blockedByOtherOrder = bookedOverlaps.stream()
                .anyMatch(schedule -> !Objects.equals(schedule.getLockedByOrderId(), order.getId()));
        if (blockedByOtherOrder) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "Provider schedule is already booked");
        }

        Schedule schedule = scheduleRepository
                .findFirstByProviderUserIdAndStatusAndStartTimeLessThanEqualAndEndTimeGreaterThanEqualOrderByStartTimeAsc(
                        order.getProviderUserId(),
                        ScheduleStatus.AVAILABLE,
                        order.getShootStartTime(),
                        order.getShootEndTime())
                .orElse(null);
        if (schedule == null) {
            return;
        }
        schedule.setStatus(ScheduleStatus.BOOKED);
        schedule.setLockedByOrderId(order.getId());
        schedule.setLockExpireTime(null);
        scheduleRepository.save(schedule);
    }

    public void releaseForCancelledOrder(Order order) {
        if (order == null || order.getId() == null) {
            return;
        }
        List<Schedule> schedules = scheduleRepository.findByLockedByOrderIdAndStatus(order.getId(), ScheduleStatus.BOOKED);
        for (Schedule schedule : schedules) {
            schedule.setStatus(ScheduleStatus.AVAILABLE);
            schedule.setLockedByOrderId(null);
            schedule.setLockExpireTime(null);
            scheduleRepository.save(schedule);
        }
    }

    private Schedule getOwnedSchedule(Long scheduleId, Long providerUserId) {
        if (scheduleId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "scheduleId must not be null");
        }
        Schedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Schedule not found: " + scheduleId));
        if (!Objects.equals(schedule.getProviderUserId(), providerUserId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only owner provider can operate this schedule");
        }
        return schedule;
    }

    private void ensureProvider(CurrentUser currentUser) {
        if (currentUser == null || currentUser.getUserId() == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Current user is required");
        }
        if (currentUser.getRole() != UserRole.PROVIDER) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only provider can manage schedules");
        }
    }

    private void validateCreateRequest(ScheduleCreateRequest request) {
        if (request == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "request must not be null");
        }
        validateBaseFields(request.cityCode(), request.startTime(), request.endTime());
    }

    private void validateUpdateRequest(ScheduleUpdateRequest request) {
        if (request == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "request must not be null");
        }
        validateBaseFields(request.cityCode(), request.startTime(), request.endTime());
    }

    private void validateBaseFields(String cityCode, LocalDateTime startTime, LocalDateTime endTime) {
        if (cityCode == null || cityCode.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "cityCode must not be blank");
        }
        if (startTime == null || endTime == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "startTime and endTime are required");
        }
        if (!endTime.isAfter(startTime)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "endTime must be after startTime");
        }
    }

    private void ensureNoOverlappingActiveSchedule(Schedule schedule, Long excludeScheduleId) {
        if (schedule.getStatus() == ScheduleStatus.UNAVAILABLE) {
            return;
        }
        List<Schedule> overlaps = scheduleRepository.findOverlappingSchedules(
                schedule.getProviderUserId(),
                ScheduleStatus.AVAILABLE,
                schedule.getStartTime(),
                schedule.getEndTime(),
                excludeScheduleId);
        if (!overlaps.isEmpty()) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "Schedule overlaps with existing available slot");
        }
    }

    private String normalize(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
