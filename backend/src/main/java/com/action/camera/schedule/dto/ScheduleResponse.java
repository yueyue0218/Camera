package com.action.camera.schedule.dto;

import com.action.camera.schedule.entity.Schedule;
import com.action.camera.schedule.enums.ScheduleStatus;

import java.time.LocalDateTime;

public record ScheduleResponse(
        Long scheduleId,
        Long providerUserId,
        String cityCode,
        String locationHint,
        LocalDateTime startTime,
        LocalDateTime endTime,
        ScheduleStatus status,
        Long lockedByOrderId,
        String timeSlot,
        String remark,
        LocalDateTime createdAt
) {

    public static ScheduleResponse from(Schedule schedule) {
        return new ScheduleResponse(
                schedule.getId(),
                schedule.getProviderUserId(),
                schedule.getCityCode(),
                schedule.getLocationHint(),
                schedule.getStartTime(),
                schedule.getEndTime(),
                schedule.getStatus(),
                schedule.getLockedByOrderId(),
                schedule.getTimeSlot(),
                schedule.getPrivateRemark(),
                schedule.getCreatedAt()
        );
    }
}
