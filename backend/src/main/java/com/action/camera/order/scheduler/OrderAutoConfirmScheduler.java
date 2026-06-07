package com.action.camera.order.scheduler;

import com.action.camera.order.service.OrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class OrderAutoConfirmScheduler {

    private final OrderService orderService;

    @Scheduled(fixedDelay = 3_600_000L, initialDelay = 60_000L)
    public void runAutoConfirm() {
        LocalDateTime now = LocalDateTime.now();
        int advancedCount = orderService.autoAdvanceShootingOrders(now);
        if (advancedCount > 0) {
            log.info("Auto-advanced {} shooting order status transitions", advancedCount);
        }
        int refundedCount = orderService.autoRefundOverdueUndeliveredOrders(now);
        if (refundedCount > 0) {
            log.info("Auto-refunded {} overdue undelivered orders", refundedCount);
        }
        int confirmedCount = orderService.autoConfirmTimeoutOrders(now);
        if (confirmedCount > 0) {
            log.info("Auto-confirmed {} delivered orders after timeout", confirmedCount);
        }
    }
}
