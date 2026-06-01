package com.action.camera.order;

import com.action.camera.order.scheduler.OrderAutoConfirmScheduler;
import com.action.camera.order.service.OrderService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrderAutoConfirmSchedulerTest {

    @Test
    void schedulerDelegatesToOrderService() {
        OrderService orderService = mock(OrderService.class);
        when(orderService.autoConfirmTimeoutOrders(org.mockito.ArgumentMatchers.any(LocalDateTime.class)))
                .thenReturn(2);
        OrderAutoConfirmScheduler scheduler = new OrderAutoConfirmScheduler(orderService);

        scheduler.runAutoConfirm();

        ArgumentCaptor<LocalDateTime> nowCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(orderService).autoConfirmTimeoutOrders(nowCaptor.capture());
        assertNotNull(nowCaptor.getValue());
    }
}
