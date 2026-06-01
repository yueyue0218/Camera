package com.action.camera.schedule;

import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.common.security.UserRole;
import com.action.camera.order.entity.Order;
import com.action.camera.schedule.dto.PublicScheduleResponse;
import com.action.camera.schedule.dto.ScheduleCreateRequest;
import com.action.camera.schedule.dto.ScheduleResponse;
import com.action.camera.schedule.dto.ScheduleUpdateRequest;
import com.action.camera.schedule.entity.Schedule;
import com.action.camera.schedule.enums.ScheduleStatus;
import com.action.camera.schedule.repository.ScheduleRepository;
import com.action.camera.schedule.service.ScheduleService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.RecordComponent;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScheduleServiceTest {

    private static final Long PROVIDER_ID = 2001L;
    private static final Long OTHER_PROVIDER_ID = 2002L;
    private static final Long CUSTOMER_ID = 1001L;
    private static final Long SCHEDULE_ID = 3001L;
    private static final Long ORDER_ID = 8001L;

    @Mock
    private ScheduleRepository scheduleRepository;

    private ScheduleService scheduleService;

    @BeforeEach
    void setUp() {
        scheduleService = new ScheduleService(scheduleRepository);
    }

    @Test
    void providerCanCreateAvailableSchedule() {
        ScheduleCreateRequest request = new ScheduleCreateRequest(
                "NJ",
                "鼓楼校区",
                LocalDateTime.of(2026, 6, 1, 9, 0),
                LocalDateTime.of(2026, 6, 1, 12, 0),
                null,
                "只接室外");
        when(scheduleRepository.findOverlappingSchedules(
                eq(PROVIDER_ID),
                eq(ScheduleStatus.AVAILABLE),
                eq(request.startTime()),
                eq(request.endTime()),
                eq(null))).thenReturn(List.of());
        when(scheduleRepository.save(any(Schedule.class))).thenAnswer(invocation -> {
            Schedule schedule = invocation.getArgument(0);
            schedule.setId(SCHEDULE_ID);
            return schedule;
        });

        ScheduleResponse response = scheduleService.createSchedule(provider(), request);

        assertEquals(SCHEDULE_ID, response.scheduleId());
        assertEquals(PROVIDER_ID, response.providerUserId());
        assertEquals(ScheduleStatus.AVAILABLE, response.status());
        verify(scheduleRepository).save(any(Schedule.class));
    }

    @Test
    void customerCannotCreateSchedule() {
        ScheduleCreateRequest request = new ScheduleCreateRequest(
                "NJ",
                "鼓楼校区",
                LocalDateTime.of(2026, 6, 1, 9, 0),
                LocalDateTime.of(2026, 6, 1, 12, 0),
                null,
                null);

        assertThrows(BusinessException.class, () -> scheduleService.createSchedule(customer(), request));

        verify(scheduleRepository, never()).save(any(Schedule.class));
    }

    @Test
    void paidOrderLocksCoveringAvailableSchedule() {
        Order order = order();
        Schedule schedule = availableSchedule();
        when(scheduleRepository.findOverlappingSchedules(
                PROVIDER_ID,
                ScheduleStatus.BOOKED,
                order.getShootStartTime(),
                order.getShootEndTime(),
                null)).thenReturn(List.of());
        when(scheduleRepository
                .findFirstByProviderUserIdAndStatusAndStartTimeLessThanEqualAndEndTimeGreaterThanEqualOrderByStartTimeAsc(
                        PROVIDER_ID,
                        ScheduleStatus.AVAILABLE,
                        order.getShootStartTime(),
                        order.getShootEndTime())).thenReturn(Optional.of(schedule));

        scheduleService.lockForPaidOrder(order);

        ArgumentCaptor<Schedule> captor = ArgumentCaptor.forClass(Schedule.class);
        verify(scheduleRepository).save(captor.capture());
        assertEquals(ScheduleStatus.BOOKED, captor.getValue().getStatus());
        assertEquals(ORDER_ID, captor.getValue().getLockedByOrderId());
    }

    @Test
    void cancelledOrderReleasesBookedSchedule() {
        Order order = order();
        Schedule schedule = bookedSchedule();
        when(scheduleRepository.findByLockedByOrderIdAndStatus(ORDER_ID, ScheduleStatus.BOOKED)).thenReturn(List.of(schedule));

        scheduleService.releaseForCancelledOrder(order);

        ArgumentCaptor<Schedule> captor = ArgumentCaptor.forClass(Schedule.class);
        verify(scheduleRepository).save(captor.capture());
        assertEquals(ScheduleStatus.AVAILABLE, captor.getValue().getStatus());
        assertNull(captor.getValue().getLockedByOrderId());
    }

    @Test
    void bookedScheduleCannotBeDeleted() {
        Schedule schedule = bookedSchedule();
        when(scheduleRepository.findById(SCHEDULE_ID)).thenReturn(Optional.of(schedule));

        assertThrows(BusinessException.class, () -> scheduleService.deleteSchedule(provider(), SCHEDULE_ID));

        verify(scheduleRepository, never()).delete(any(Schedule.class));
    }

    @Test
    void providerCannotUpdateOtherProvidersSchedule() {
        Schedule schedule = availableSchedule();
        schedule.setProviderUserId(OTHER_PROVIDER_ID);
        when(scheduleRepository.findById(SCHEDULE_ID)).thenReturn(Optional.of(schedule));

        ScheduleUpdateRequest request = new ScheduleUpdateRequest(
                "NJ",
                "仙林校区",
                LocalDateTime.of(2026, 6, 2, 9, 0),
                LocalDateTime.of(2026, 6, 2, 12, 0),
                ScheduleStatus.AVAILABLE,
                null,
                null);

        assertThrows(BusinessException.class, () -> scheduleService.updateSchedule(provider(), SCHEDULE_ID, request));

        verify(scheduleRepository, never()).save(any(Schedule.class));
    }

    @Test
    void publicAvailableScheduleDoesNotExposePrivateFields() {
        Schedule schedule = availableSchedule();
        schedule.setPrivateRemark("客户隐私备注");
        schedule.setLockedByOrderId(ORDER_ID);
        when(scheduleRepository.findPublicAvailableSchedules(
                eq(PROVIDER_ID),
                eq("NJ"),
                eq(LocalDate.of(2026, 6, 1).atStartOfDay()),
                eq(LocalDate.of(2026, 6, 2).atStartOfDay()))).thenReturn(List.of(schedule));

        List<PublicScheduleResponse> responses = scheduleService.listPublicAvailable(
                PROVIDER_ID,
                "NJ",
                LocalDate.of(2026, 6, 1),
                LocalDate.of(2026, 6, 1));

        assertEquals(1, responses.size());
        assertEquals(SCHEDULE_ID, responses.get(0).scheduleId());
        List<String> fieldNames = Arrays.stream(PublicScheduleResponse.class.getRecordComponents())
                .map(RecordComponent::getName)
                .toList();
        assertFalse(fieldNames.contains("privateRemark"));
        assertFalse(fieldNames.contains("lockedByOrderId"));
    }

    private CurrentUser provider() {
        return new CurrentUser(PROVIDER_ID, UserRole.PROVIDER);
    }

    private CurrentUser customer() {
        return new CurrentUser(CUSTOMER_ID, UserRole.CUSTOMER);
    }

    private Schedule availableSchedule() {
        Schedule schedule = new Schedule();
        schedule.setId(SCHEDULE_ID);
        schedule.setProviderUserId(PROVIDER_ID);
        schedule.setCityCode("NJ");
        schedule.setLocationHint("鼓楼校区");
        schedule.setStartTime(LocalDateTime.of(2026, 6, 1, 9, 0));
        schedule.setEndTime(LocalDateTime.of(2026, 6, 1, 12, 0));
        schedule.setStatus(ScheduleStatus.AVAILABLE);
        return schedule;
    }

    private Schedule bookedSchedule() {
        Schedule schedule = availableSchedule();
        schedule.setStatus(ScheduleStatus.BOOKED);
        schedule.setLockedByOrderId(ORDER_ID);
        return schedule;
    }

    private Order order() {
        Order order = new Order();
        order.setId(ORDER_ID);
        order.setProviderUserId(PROVIDER_ID);
        order.setCustomerId(CUSTOMER_ID);
        order.setShootStartTime(LocalDateTime.of(2026, 6, 1, 9, 30));
        order.setShootEndTime(LocalDateTime.of(2026, 6, 1, 11, 30));
        return order;
    }
}
