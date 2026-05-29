package com.action.camera.schedule.dto;

import java.time.LocalDateTime;

public record ScheduleCreateRequest(
        String cityCode,
        String locationHint,
        LocalDateTime startTime,
        LocalDateTime endTime,
        String timeSlot,
        String remark
) {
}
