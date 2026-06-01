package com.action.camera.schedule.controller;

import com.action.camera.common.Result;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.common.security.MockCurrentUserProvider;
import com.action.camera.schedule.dto.PublicScheduleResponse;
import com.action.camera.schedule.dto.ScheduleCreateRequest;
import com.action.camera.schedule.dto.ScheduleResponse;
import com.action.camera.schedule.dto.ScheduleUpdateRequest;
import com.action.camera.schedule.service.ScheduleService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
public class ScheduleController {

    private final ScheduleService scheduleService;
    private final MockCurrentUserProvider currentUserProvider;

    public ScheduleController(ScheduleService scheduleService, MockCurrentUserProvider currentUserProvider) {
        this.scheduleService = scheduleService;
        this.currentUserProvider = currentUserProvider;
    }

    @PostMapping("/providers/me/schedules")
    public Result<ScheduleResponse> createSchedule(@RequestBody ScheduleCreateRequest request,
                                                   HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(scheduleService.createSchedule(currentUser, request));
    }

    @GetMapping("/providers/me/schedules")
    public Result<List<ScheduleResponse>> listMine(HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(scheduleService.listMine(currentUser));
    }

    @PutMapping("/providers/me/schedules/{scheduleId}")
    public Result<ScheduleResponse> updateSchedule(@PathVariable Long scheduleId,
                                                   @RequestBody ScheduleUpdateRequest request,
                                                   HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        return Result.success(scheduleService.updateSchedule(currentUser, scheduleId, request));
    }

    @DeleteMapping("/providers/me/schedules/{scheduleId}")
    public Result<Void> deleteSchedule(@PathVariable Long scheduleId,
                                       HttpServletRequest httpRequest) {
        CurrentUser currentUser = currentUserProvider.getCurrentUser(httpRequest);
        scheduleService.deleteSchedule(currentUser, scheduleId);
        return Result.success(null);
    }

    @GetMapping("/providers/{providerUserId}/schedules")
    public Result<List<PublicScheduleResponse>> listPublicAvailable(
            @PathVariable Long providerUserId,
            @RequestParam(required = false) String cityCode,
            @RequestParam(required = false) LocalDate startDate,
            @RequestParam(required = false) LocalDate endDate) {
        return Result.success(scheduleService.listPublicAvailable(providerUserId, cityCode, startDate, endDate));
    }
}
