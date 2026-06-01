package com.action.camera.schedule.dto;

import com.action.camera.schedule.enums.ScheduleStatus;

import java.time.LocalDateTime;

public record ScheduleUpdateRequest(
        String cityCode,
        String locationHint,
        LocalDateTime startTime,
        LocalDateTime endTime,
        ScheduleStatus status,
        String timeSlot,
        String remark
) {
}
