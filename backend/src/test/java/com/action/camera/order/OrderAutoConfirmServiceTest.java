package com.action.camera.order;

import com.action.camera.common.exception.BusinessException;
import com.action.camera.order.entity.Order;
import com.action.camera.order.entity.OrderStatusLog;
import com.action.camera.order.enums.EscrowStatus;
import com.action.camera.order.enums.OrderStatus;
import com.action.camera.order.repository.OrderRepository;
import com.action.camera.order.repository.OrderStatusLogRepository;
import com.action.camera.order.repository.PaymentRecordRepository;
import com.action.camera.order.service.OrderService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderAutoConfirmServiceTest {

    private static final Long ORDER_ID = 8001L;
    private static final Long SECOND_ORDER_ID = 8002L;
    private static final Long CUSTOMER_ID = 1001L;
    private static final Long PROVIDER_ID = 2001L;
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 6, 15, 12, 0);

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private PaymentRecordRepository paymentRecordRepository;

    @Mock
    private OrderStatusLogRepository orderStatusLogRepository;

    private OrderService orderService;

    @BeforeEach
    void setUp() {
        orderService = new OrderService(orderRepository, paymentRecordRepository, orderStatusLogRepository);
    }

    @Test
    void autoConfirmDeliveredOrderAfterSevenDaysAndWriteStatusLog() {
        Order order = order(ORDER_ID, OrderStatus.DELIVERED_PENDING_CONFIRM);
        when(orderRepository.findByStatus(OrderStatus.DELIVERED_PENDING_CONFIRM)).thenReturn(List.of(order));
        whenLocked(order);
        whenLatestDeliveredLog(ORDER_ID, NOW.minusDays(7).minusMinutes(1));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(orderStatusLogRepository.save(any(OrderStatusLog.class))).thenAnswer(invocation -> invocation.getArgument(0));

        int confirmedCount = orderService.autoConfirmTimeoutOrders(NOW);

        assertEquals(1, confirmedCount);
        assertEquals(OrderStatus.COMPLETED, order.getStatus());
        assertEquals(EscrowStatus.RELEASED, order.getEscrowStatus());
        assertEquals("SETTLED", order.getSettlementStatus());
        assertEquals(NOW, order.getAutoConfirmTime());
        assertEquals(NOW, order.getCompleteTime());

        ArgumentCaptor<OrderStatusLog> logCaptor = ArgumentCaptor.forClass(OrderStatusLog.class);
        verify(orderStatusLogRepository).save(logCaptor.capture());
        OrderStatusLog statusLog = logCaptor.getValue();
        assertEquals(OrderStatus.DELIVERED_PENDING_CONFIRM, statusLog.getFromStatus());
        assertEquals(OrderStatus.COMPLETED, statusLog.getToStatus());
        assertEquals(0L, statusLog.getOperatorId());
        assertEquals("SYSTEM", statusLog.getOperatorRole());
        assertEquals("交付后 7 天未操作，系统自动确认完成", statusLog.getRemark());
    }

    @Test
    void autoConfirmReturnsProcessedCountAcrossEligibleOrdersOnly() {
        Order timedOutOrder = order(ORDER_ID, OrderStatus.DELIVERED_PENDING_CONFIRM);
        Order waitingOrder = order(SECOND_ORDER_ID, OrderStatus.DELIVERED_PENDING_CONFIRM);
        when(orderRepository.findByStatus(OrderStatus.DELIVERED_PENDING_CONFIRM))
                .thenReturn(List.of(timedOutOrder, waitingOrder));
        whenLocked(timedOutOrder);
        whenLocked(waitingOrder);
        whenLatestDeliveredLog(ORDER_ID, NOW.minusDays(7));
        whenLatestDeliveredLog(SECOND_ORDER_ID, NOW.minusDays(6).minusHours(23));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(orderStatusLogRepository.save(any(OrderStatusLog.class))).thenAnswer(invocation -> invocation.getArgument(0));

        int confirmedCount = orderService.autoConfirmTimeoutOrders(NOW);

        assertEquals(1, confirmedCount);
        assertEquals(OrderStatus.COMPLETED, timedOutOrder.getStatus());
        assertEquals(EscrowStatus.RELEASED, timedOutOrder.getEscrowStatus());
        assertEquals("SETTLED", timedOutOrder.getSettlementStatus());
        assertEquals(OrderStatus.DELIVERED_PENDING_CONFIRM, waitingOrder.getStatus());
        assertEquals(EscrowStatus.HELD, waitingOrder.getEscrowStatus());
        assertEquals("NOT_SETTLED", waitingOrder.getSettlementStatus());
    }

    @Test
    void autoConfirmSkipsDeliveredOrderBeforeSevenDays() {
        Order order = order(ORDER_ID, OrderStatus.DELIVERED_PENDING_CONFIRM);
        when(orderRepository.findByStatus(OrderStatus.DELIVERED_PENDING_CONFIRM)).thenReturn(List.of(order));
        whenLocked(order);
        whenLatestDeliveredLog(ORDER_ID, NOW.minusDays(7).plusSeconds(1));

        int confirmedCount = orderService.autoConfirmTimeoutOrders(NOW);

        assertEquals(0, confirmedCount);
        assertEquals(OrderStatus.DELIVERED_PENDING_CONFIRM, order.getStatus());
        assertEquals(EscrowStatus.HELD, order.getEscrowStatus());
        assertEquals("NOT_SETTLED", order.getSettlementStatus());
        verify(orderRepository, never()).save(any(Order.class));
        verify(orderStatusLogRepository, never()).save(any(OrderStatusLog.class));
    }

    @Test
    void autoConfirmUsesLatestDeliveredPendingConfirmLogAfterRework() {
        Order order = order(ORDER_ID, OrderStatus.DELIVERED_PENDING_CONFIRM);
        when(orderRepository.findByStatus(OrderStatus.DELIVERED_PENDING_CONFIRM)).thenReturn(List.of(order));
        whenLocked(order);
        whenLatestDeliveredLog(ORDER_ID, NOW.minusDays(1));

        int confirmedCount = orderService.autoConfirmTimeoutOrders(NOW);

        assertEquals(0, confirmedCount);
        assertEquals(OrderStatus.DELIVERED_PENDING_CONFIRM, order.getStatus());
        verify(orderStatusLogRepository).findFirstByOrderIdAndToStatusOrderByCreatedAtDesc(
                ORDER_ID,
                OrderStatus.DELIVERED_PENDING_CONFIRM
        );
        verify(orderRepository, never()).save(any(Order.class));
    }

    @Test
    void autoConfirmLocksOrderAndSkipsWhenConcurrentCallAlreadyCompletedIt() {
        Order candidate = order(ORDER_ID, OrderStatus.DELIVERED_PENDING_CONFIRM);
        Order lockedOrder = order(ORDER_ID, OrderStatus.COMPLETED);
        lockedOrder.setEscrowStatus(EscrowStatus.RELEASED);
        lockedOrder.setSettlementStatus("SETTLED");
        when(orderRepository.findByStatus(OrderStatus.DELIVERED_PENDING_CONFIRM)).thenReturn(List.of(candidate));
        when(orderRepository.findByIdForUpdate(ORDER_ID)).thenReturn(Optional.of(lockedOrder));

        int confirmedCount = orderService.autoConfirmTimeoutOrders(NOW);

        assertEquals(0, confirmedCount);
        verify(orderRepository).findByIdForUpdate(ORDER_ID);
        verify(orderStatusLogRepository, never())
                .findFirstByOrderIdAndToStatusOrderByCreatedAtDesc(any(), any());
        verify(orderRepository, never()).save(any(Order.class));
        verify(orderStatusLogRepository, never()).save(any(OrderStatusLog.class));
    }

    @Test
    void autoConfirmSkipsReworkAppealingAndTerminalOrdersDefensively() {
        List<Order> orders = List.of(
                order(8003L, OrderStatus.REWORK_REQUIRED),
                order(8004L, OrderStatus.APPEALING),
                order(8005L, OrderStatus.COMPLETED),
                order(8006L, OrderStatus.CANCELLED),
                order(8007L, OrderStatus.REFUNDED)
        );
        when(orderRepository.findByStatus(OrderStatus.DELIVERED_PENDING_CONFIRM)).thenReturn(orders);
        for (Order order : orders) {
            whenLocked(order);
        }

        int confirmedCount = orderService.autoConfirmTimeoutOrders(NOW);

        assertEquals(0, confirmedCount);
        for (Order order : orders) {
            assertNotNull(order.getStatus());
            assertEquals(EscrowStatus.HELD, order.getEscrowStatus());
            assertEquals("NOT_SETTLED", order.getSettlementStatus());
        }
        verify(orderStatusLogRepository, never())
                .findFirstByOrderIdAndToStatusOrderByCreatedAtDesc(any(), any());
        verify(orderRepository, never()).save(any(Order.class));
        verify(orderStatusLogRepository, never()).save(any(OrderStatusLog.class));
    }

    @Test
    void autoConfirmSkipsOrderWithoutDeliveredPendingConfirmLog() {
        Order order = order(ORDER_ID, OrderStatus.DELIVERED_PENDING_CONFIRM);
        when(orderRepository.findByStatus(OrderStatus.DELIVERED_PENDING_CONFIRM)).thenReturn(List.of(order));
        whenLocked(order);
        when(orderStatusLogRepository.findFirstByOrderIdAndToStatusOrderByCreatedAtDesc(
                ORDER_ID,
                OrderStatus.DELIVERED_PENDING_CONFIRM
        )).thenReturn(Optional.empty());

        int confirmedCount = orderService.autoConfirmTimeoutOrders(NOW);

        assertEquals(0, confirmedCount);
        assertEquals(OrderStatus.DELIVERED_PENDING_CONFIRM, order.getStatus());
        assertEquals(EscrowStatus.HELD, order.getEscrowStatus());
        assertEquals("NOT_SETTLED", order.getSettlementStatus());
        verify(orderRepository, never()).save(any(Order.class));
        verify(orderStatusLogRepository, never()).save(any(OrderStatusLog.class));
    }

    @Test
    void autoConfirmRejectsNullNow() {
        assertThrows(BusinessException.class, () -> orderService.autoConfirmTimeoutOrders(null));
    }

    private void whenLatestDeliveredLog(Long orderId, LocalDateTime createdAt) {
        when(orderStatusLogRepository.findFirstByOrderIdAndToStatusOrderByCreatedAtDesc(
                orderId,
                OrderStatus.DELIVERED_PENDING_CONFIRM
        )).thenReturn(Optional.of(statusLog(orderId, createdAt)));
    }

    private void whenLocked(Order order) {
        when(orderRepository.findByIdForUpdate(order.getId())).thenReturn(Optional.of(order));
    }

    private OrderStatusLog statusLog(Long orderId, LocalDateTime createdAt) {
        OrderStatusLog log = new OrderStatusLog();
        log.setOrderId(orderId);
        log.setFromStatus(OrderStatus.PENDING_DELIVERY);
        log.setToStatus(OrderStatus.DELIVERED_PENDING_CONFIRM);
        log.setOperatorId(PROVIDER_ID);
        log.setOperatorRole("PROVIDER");
        log.setReason("服务方上传交付文件");
        log.setCreatedAt(createdAt);
        return log;
    }

    private Order order(Long orderId, OrderStatus status) {
        Order order = new Order();
        order.setId(orderId);
        order.setOrderNo("O20260601000" + orderId);
        order.setQuoteId(7001L);
        order.setConversationId(9001L);
        order.setCustomerId(CUSTOMER_ID);
        order.setProviderUserId(PROVIDER_ID);
        order.setStatus(status);
        order.setEscrowStatus(EscrowStatus.HELD);
        order.setSettlementStatus("NOT_SETTLED");
        order.setRefundStatus("NONE");
        order.setTotalAmountCent(39900L);
        order.setShootStartTime(LocalDateTime.of(2026, 6, 1, 9, 0));
        order.setShootEndTime(LocalDateTime.of(2026, 6, 1, 12, 0));
        order.setShootLocation("南京大学鼓楼校区");
        order.setDeliveryDeadline(LocalDateTime.of(2026, 6, 8, 12, 0));
        order.setPhotoUsageScope("PERSONAL_ONLY");
        order.setQuoteSnapshotJson("{}");
        order.setCreatedAt(LocalDateTime.of(2026, 5, 30, 10, 0));
        order.setUpdatedAt(LocalDateTime.of(2026, 5, 30, 10, 0));
        return order;
    }
}
