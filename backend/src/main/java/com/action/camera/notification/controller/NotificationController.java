package com.action.camera.notification.controller;

import com.action.camera.common.Result;
import com.action.camera.common.page.PageResult;
import com.action.camera.notification.dto.NotificationResponse;
import com.action.camera.notification.service.NotificationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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
    public Result<PageResult<NotificationResponse>> listMine(@RequestParam(required = false, defaultValue = "0") Integer page,
                                                             @RequestParam(required = false, defaultValue = "20") Integer size,
                                                             @RequestParam(required = false) Boolean isRead) {
        return Result.success(notificationService.listMine(page, size, isRead));
    }

    @GetMapping("/unread-count")
    public Result<Long> unreadCount() {
        return Result.success(notificationService.unreadCount());
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
