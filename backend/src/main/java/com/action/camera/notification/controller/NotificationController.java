package com.action.camera.notification.controller;

import com.action.camera.common.Result;
import com.action.camera.notification.dto.NotificationResponse;
import com.action.camera.notification.service.NotificationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public Result<List<NotificationResponse>> listMine() {
        return Result.success(notificationService.listMine());
    }

    @PatchMapping("/{notificationId}/read")
    public Result<NotificationResponse> markRead(@PathVariable Long notificationId) {
        return Result.success(notificationService.markRead(notificationId));
    }

    @PatchMapping("/read-all")
    public Result<List<NotificationResponse>> markAllRead() {
        return Result.success(notificationService.markAllRead());
    }
}
