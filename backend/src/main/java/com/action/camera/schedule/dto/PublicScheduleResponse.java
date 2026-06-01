package com.action.camera.schedule.dto;

import com.action.camera.schedule.entity.Schedule;

import java.time.LocalDateTime;

public record PublicScheduleResponse(
        Long scheduleId,
        Long providerUserId,
        String cityCode,
        String locationHint,
        LocalDateTime startTime,
        LocalDateTime endTime
) {

    public static PublicScheduleResponse from(Schedule schedule) {
        return new PublicScheduleResponse(
                schedule.getId(),
                schedule.getProviderUserId(),
                schedule.getCityCode(),
                schedule.getLocationHint(),
                schedule.getStartTime(),
                schedule.getEndTime()
        );
    }
}
