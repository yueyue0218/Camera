package com.action.camera.order;

import com.action.camera.common.exception.BusinessException;
import com.action.camera.delivery.repository.DeliveryRepository;
import com.action.camera.order.entity.Order;
import com.action.camera.order.entity.OrderStatusLog;
import com.action.camera.order.entity.PaymentRecord;
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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
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

    @Mock
    private DeliveryRepository deliveryRepository;

    private OrderService orderService;

    @BeforeEach
    void setUp() {
        orderService = new OrderService(orderRepository, paymentRecordRepository, orderStatusLogRepository, deliveryRepository);
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
        assertNull(statusLog.getOperatorId());
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

    @Test
    void autoAdvanceKeepsPaidOrderBeforeShootStart() {
        Order order = order(ORDER_ID, OrderStatus.PAID_PENDING_SHOOT);
        when(orderRepository.findByStatus(OrderStatus.PAID_PENDING_SHOOT)).thenReturn(List.of(order));
        when(orderRepository.findByStatus(OrderStatus.SHOOTING)).thenReturn(List.of());
        whenLocked(order);

        int advancedCount = orderService.autoAdvanceShootingOrders(order.getShootStartTime().minusSeconds(1));

        assertEquals(0, advancedCount);
        assertEquals(OrderStatus.PAID_PENDING_SHOOT, order.getStatus());
        verify(orderRepository, never()).save(any(Order.class));
        verify(orderStatusLogRepository, never()).save(any(OrderStatusLog.class));
    }

    @Test
    void syncTimelineAdvancesPaidOrderToShootingAfterShootStart() {
        Order order = order(ORDER_ID, OrderStatus.PAID_PENDING_SHOOT);
        whenLocked(order);
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(orderStatusLogRepository.save(any(OrderStatusLog.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Order syncedOrder = orderService.syncTimelineStatusIfDue(
                ORDER_ID,
                order.getShootStartTime().plusMinutes(1)
        );

        assertEquals(OrderStatus.SHOOTING, syncedOrder.getStatus());
        ArgumentCaptor<OrderStatusLog> logCaptor = ArgumentCaptor.forClass(OrderStatusLog.class);
        verify(orderStatusLogRepository).save(logCaptor.capture());
        assertEquals(OrderStatus.PAID_PENDING_SHOOT, logCaptor.getValue().getFromStatus());
        assertEquals(OrderStatus.SHOOTING, logCaptor.getValue().getToStatus());
        assertNull(logCaptor.getValue().getOperatorId());
        assertEquals("SYSTEM", logCaptor.getValue().getOperatorRole());
        assertEquals("系统根据拍摄开始时间自动进入拍摄中", logCaptor.getValue().getRemark());
    }

    @Test
    void syncTimelineAdvancesShootingOrderToPendingDeliveryAfterShootEnd() {
        Order order = order(ORDER_ID, OrderStatus.SHOOTING);
        whenLocked(order);
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(orderStatusLogRepository.save(any(OrderStatusLog.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Order syncedOrder = orderService.syncTimelineStatusIfDue(
                ORDER_ID,
                order.getShootEndTime()
        );

        assertEquals(OrderStatus.PENDING_DELIVERY, syncedOrder.getStatus());
        ArgumentCaptor<OrderStatusLog> logCaptor = ArgumentCaptor.forClass(OrderStatusLog.class);
        verify(orderStatusLogRepository).save(logCaptor.capture());
        assertEquals(OrderStatus.SHOOTING, logCaptor.getValue().getFromStatus());
        assertEquals(OrderStatus.PENDING_DELIVERY, logCaptor.getValue().getToStatus());
        assertNull(logCaptor.getValue().getOperatorId());
        assertEquals("SYSTEM", logCaptor.getValue().getOperatorRole());
        assertEquals("系统根据拍摄结束时间自动进入待交付", logCaptor.getValue().getRemark());
    }

    @Test
    void syncTimelineAdvancesPaidOrderPastShootEndThroughTwoStatusLogs() {
        Order order = order(ORDER_ID, OrderStatus.PAID_PENDING_SHOOT);
        whenLocked(order);
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(orderStatusLogRepository.save(any(OrderStatusLog.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Order syncedOrder = orderService.syncTimelineStatusIfDue(
                ORDER_ID,
                order.getShootEndTime().plusMinutes(1)
        );

        assertEquals(OrderStatus.PENDING_DELIVERY, syncedOrder.getStatus());
        ArgumentCaptor<OrderStatusLog> logCaptor = ArgumentCaptor.forClass(OrderStatusLog.class);
        verify(orderStatusLogRepository, times(2)).save(logCaptor.capture());
        List<OrderStatusLog> logs = logCaptor.getAllValues();
        assertEquals(OrderStatus.PAID_PENDING_SHOOT, logs.get(0).getFromStatus());
        assertEquals(OrderStatus.SHOOTING, logs.get(0).getToStatus());
        assertEquals("SYSTEM", logs.get(0).getOperatorRole());
        assertEquals(OrderStatus.SHOOTING, logs.get(1).getFromStatus());
        assertEquals(OrderStatus.PENDING_DELIVERY, logs.get(1).getToStatus());
        assertEquals("SYSTEM", logs.get(1).getOperatorRole());
    }

    @Test
    void syncTimelineDoesNotOverrideTerminalDeliveredReworkOrAppealingOrders() {
        List<OrderStatus> statuses = List.of(
                OrderStatus.COMPLETED,
                OrderStatus.CANCELLED,
                OrderStatus.REFUNDED,
                OrderStatus.DELIVERED_PENDING_CONFIRM,
                OrderStatus.REWORK_REQUIRED,
                OrderStatus.APPEALING
        );

        for (int index = 0; index < statuses.size(); index++) {
            OrderStatus status = statuses.get(index);
            Order order = order(8100L + index, status);
            when(orderRepository.findByIdForUpdate(order.getId())).thenReturn(Optional.of(order));

            Order syncedOrder = orderService.syncTimelineStatusIfDue(
                    order.getId(),
                    order.getShootEndTime().plusDays(1)
            );

            assertEquals(status, syncedOrder.getStatus());
        }
        verify(orderRepository, never()).save(any(Order.class));
        verify(orderStatusLogRepository, never()).save(any(OrderStatusLog.class));
    }

    @Test
    void autoAdvancePaidOrderToShootingDuringShootWindow() {
        Order order = order(ORDER_ID, OrderStatus.PAID_PENDING_SHOOT);
        when(orderRepository.findByStatus(OrderStatus.PAID_PENDING_SHOOT)).thenReturn(List.of(order));
        when(orderRepository.findByStatus(OrderStatus.SHOOTING)).thenReturn(List.of());
        whenLocked(order);
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(orderStatusLogRepository.save(any(OrderStatusLog.class))).thenAnswer(invocation -> invocation.getArgument(0));

        int advancedCount = orderService.autoAdvanceShootingOrders(order.getShootStartTime().plusMinutes(10));

        assertEquals(1, advancedCount);
        assertEquals(OrderStatus.SHOOTING, order.getStatus());
        ArgumentCaptor<OrderStatusLog> logCaptor = ArgumentCaptor.forClass(OrderStatusLog.class);
        verify(orderStatusLogRepository).save(logCaptor.capture());
        assertEquals(OrderStatus.PAID_PENDING_SHOOT, logCaptor.getValue().getFromStatus());
        assertEquals(OrderStatus.SHOOTING, logCaptor.getValue().getToStatus());
        assertNull(logCaptor.getValue().getOperatorId());
        assertEquals("SYSTEM", logCaptor.getValue().getOperatorRole());
        assertEquals("系统根据拍摄开始时间自动进入拍摄中", logCaptor.getValue().getRemark());
    }

    @Test
    void autoAdvancePaidOrderPastShootEndThroughShootingToPendingDelivery() {
        Order order = order(ORDER_ID, OrderStatus.PAID_PENDING_SHOOT);
        when(orderRepository.findByStatus(OrderStatus.PAID_PENDING_SHOOT)).thenReturn(List.of(order));
        when(orderRepository.findByStatus(OrderStatus.SHOOTING)).thenReturn(List.of());
        whenLocked(order);
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(orderStatusLogRepository.save(any(OrderStatusLog.class))).thenAnswer(invocation -> invocation.getArgument(0));

        int advancedCount = orderService.autoAdvanceShootingOrders(order.getShootEndTime().plusMinutes(1));

        assertEquals(2, advancedCount);
        assertEquals(OrderStatus.PENDING_DELIVERY, order.getStatus());
        ArgumentCaptor<OrderStatusLog> logCaptor = ArgumentCaptor.forClass(OrderStatusLog.class);
        verify(orderStatusLogRepository, times(2)).save(logCaptor.capture());
        List<OrderStatusLog> logs = logCaptor.getAllValues();
        assertEquals(OrderStatus.PAID_PENDING_SHOOT, logs.get(0).getFromStatus());
        assertEquals(OrderStatus.SHOOTING, logs.get(0).getToStatus());
        assertNull(logs.get(0).getOperatorId());
        assertEquals("SYSTEM", logs.get(0).getOperatorRole());
        assertEquals(OrderStatus.SHOOTING, logs.get(1).getFromStatus());
        assertEquals(OrderStatus.PENDING_DELIVERY, logs.get(1).getToStatus());
        assertNull(logs.get(1).getOperatorId());
        assertEquals("SYSTEM", logs.get(1).getOperatorRole());
    }

    @Test
    void autoAdvanceKeepsShootingOrderBeforeShootEnd() {
        Order order = order(ORDER_ID, OrderStatus.SHOOTING);
        when(orderRepository.findByStatus(OrderStatus.PAID_PENDING_SHOOT)).thenReturn(List.of());
        when(orderRepository.findByStatus(OrderStatus.SHOOTING)).thenReturn(List.of(order));
        whenLocked(order);

        int advancedCount = orderService.autoAdvanceShootingOrders(order.getShootEndTime().minusSeconds(1));

        assertEquals(0, advancedCount);
        assertEquals(OrderStatus.SHOOTING, order.getStatus());
        verify(orderRepository, never()).save(any(Order.class));
        verify(orderStatusLogRepository, never()).save(any(OrderStatusLog.class));
    }

    @Test
    void autoAdvanceShootingOrderToPendingDeliveryAfterShootEnd() {
        Order order = order(ORDER_ID, OrderStatus.SHOOTING);
        when(orderRepository.findByStatus(OrderStatus.PAID_PENDING_SHOOT)).thenReturn(List.of());
        when(orderRepository.findByStatus(OrderStatus.SHOOTING)).thenReturn(List.of(order));
        whenLocked(order);
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(orderStatusLogRepository.save(any(OrderStatusLog.class))).thenAnswer(invocation -> invocation.getArgument(0));

        int advancedCount = orderService.autoAdvanceShootingOrders(order.getShootEndTime());

        assertEquals(1, advancedCount);
        assertEquals(OrderStatus.PENDING_DELIVERY, order.getStatus());
        ArgumentCaptor<OrderStatusLog> logCaptor = ArgumentCaptor.forClass(OrderStatusLog.class);
        verify(orderStatusLogRepository).save(logCaptor.capture());
        assertEquals(OrderStatus.SHOOTING, logCaptor.getValue().getFromStatus());
        assertEquals(OrderStatus.PENDING_DELIVERY, logCaptor.getValue().getToStatus());
        assertNull(logCaptor.getValue().getOperatorId());
        assertEquals("SYSTEM", logCaptor.getValue().getOperatorRole());
        assertEquals("系统根据拍摄结束时间自动进入待交付", logCaptor.getValue().getRemark());
    }

    @Test
    void autoAdvanceSkipsConcurrentTerminalOrDisputedOrdersDefensively() {
        Order paidCandidate = order(ORDER_ID, OrderStatus.PAID_PENDING_SHOOT);
        Order shootingCandidate = order(SECOND_ORDER_ID, OrderStatus.SHOOTING);
        Order completedLocked = order(ORDER_ID, OrderStatus.COMPLETED);
        Order appealingLocked = order(SECOND_ORDER_ID, OrderStatus.APPEALING);
        when(orderRepository.findByStatus(OrderStatus.PAID_PENDING_SHOOT)).thenReturn(List.of(paidCandidate));
        when(orderRepository.findByStatus(OrderStatus.SHOOTING)).thenReturn(List.of(shootingCandidate));
        when(orderRepository.findByIdForUpdate(ORDER_ID)).thenReturn(Optional.of(completedLocked));
        when(orderRepository.findByIdForUpdate(SECOND_ORDER_ID)).thenReturn(Optional.of(appealingLocked));

        int advancedCount = orderService.autoAdvanceShootingOrders(NOW);

        assertEquals(0, advancedCount);
        assertEquals(OrderStatus.COMPLETED, completedLocked.getStatus());
        assertEquals(OrderStatus.APPEALING, appealingLocked.getStatus());
        verify(orderRepository, never()).save(any(Order.class));
        verify(orderStatusLogRepository, never()).save(any(OrderStatusLog.class));
    }

    @Test
    void autoAdvanceRejectsNullNow() {
        assertThrows(BusinessException.class, () -> orderService.autoAdvanceShootingOrders(null));
    }

    @Test
    void autoRefundKeepsPendingDeliveryBeforeDeadline() {
        Order order = order(ORDER_ID, OrderStatus.PENDING_DELIVERY);
        when(orderRepository.findByStatus(OrderStatus.PENDING_DELIVERY)).thenReturn(List.of(order));
        whenLocked(order);

        int refundedCount = orderService.autoRefundOverdueUndeliveredOrders(order.getDeliveryDeadline());

        assertEquals(0, refundedCount);
        assertEquals(OrderStatus.PENDING_DELIVERY, order.getStatus());
        verify(deliveryRepository, never()).existsByOrderId(any());
        verify(orderRepository, never()).save(any(Order.class));
    }

    @Test
    void autoRefundKeepsPendingDeliveryAfterDeadlineWhenDeliveryExists() {
        Order order = order(ORDER_ID, OrderStatus.PENDING_DELIVERY);
        when(orderRepository.findByStatus(OrderStatus.PENDING_DELIVERY)).thenReturn(List.of(order));
        whenLocked(order);
        when(deliveryRepository.existsByOrderId(ORDER_ID)).thenReturn(true);

        int refundedCount = orderService.autoRefundOverdueUndeliveredOrders(order.getDeliveryDeadline().plusMinutes(1));

        assertEquals(0, refundedCount);
        assertEquals(OrderStatus.PENDING_DELIVERY, order.getStatus());
        verify(orderRepository, never()).save(any(Order.class));
        verify(orderStatusLogRepository, never()).save(any(OrderStatusLog.class));
    }

    @Test
    void autoRefundOverduePendingDeliveryWithoutDeliveryAndUpdatePaymentRecord() {
        Order order = order(ORDER_ID, OrderStatus.PENDING_DELIVERY);
        PaymentRecord paymentRecord = paymentRecord(order);
        when(orderRepository.findByStatus(OrderStatus.PENDING_DELIVERY)).thenReturn(List.of(order));
        whenLocked(order);
        when(deliveryRepository.existsByOrderId(ORDER_ID)).thenReturn(false);
        when(paymentRecordRepository.findByOrderId(ORDER_ID)).thenReturn(Optional.of(paymentRecord));
        when(paymentRecordRepository.save(any(PaymentRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(orderStatusLogRepository.save(any(OrderStatusLog.class))).thenAnswer(invocation -> invocation.getArgument(0));

        int refundedCount = orderService.autoRefundOverdueUndeliveredOrders(order.getDeliveryDeadline().plusMinutes(1));

        assertEquals(1, refundedCount);
        assertEquals(OrderStatus.REFUNDED, order.getStatus());
        assertEquals(EscrowStatus.REFUNDED, order.getEscrowStatus());
        assertEquals("NOT_SETTLED", order.getSettlementStatus());
        assertEquals("REFUNDED", order.getRefundStatus());
        assertEquals(order.getTotalAmountCent(), paymentRecord.getRefundAmountCent());
        assertEquals("REFUNDED", paymentRecord.getStatus());
        assertNotNull(paymentRecord.getRefundedAt());
        ArgumentCaptor<OrderStatusLog> logCaptor = ArgumentCaptor.forClass(OrderStatusLog.class);
        verify(orderStatusLogRepository).save(logCaptor.capture());
        assertEquals(OrderStatus.PENDING_DELIVERY, logCaptor.getValue().getFromStatus());
        assertEquals(OrderStatus.REFUNDED, logCaptor.getValue().getToStatus());
        assertNull(logCaptor.getValue().getOperatorId());
        assertEquals("SYSTEM", logCaptor.getValue().getOperatorRole());
        assertEquals("超过最晚交付时间仍未上传作品，系统自动退款并结束订单", logCaptor.getValue().getRemark());
    }

    @Test
    void autoRefundSkipsPendingDeliveryWithoutDeadline() {
        Order order = order(ORDER_ID, OrderStatus.PENDING_DELIVERY);
        order.setDeliveryDeadline(null);
        when(orderRepository.findByStatus(OrderStatus.PENDING_DELIVERY)).thenReturn(List.of(order));
        whenLocked(order);

        int refundedCount = orderService.autoRefundOverdueUndeliveredOrders(NOW);

        assertEquals(0, refundedCount);
        assertEquals(OrderStatus.PENDING_DELIVERY, order.getStatus());
        verify(deliveryRepository, never()).existsByOrderId(any());
        verify(orderRepository, never()).save(any(Order.class));
    }

    @Test
    void autoRefundSkipsNonPendingDeliveryStatusesDefensively() {
        List<Order> candidates = List.of(
                order(8003L, OrderStatus.DELIVERED_PENDING_CONFIRM),
                order(8004L, OrderStatus.REWORK_REQUIRED),
                order(8005L, OrderStatus.APPEALING),
                order(8006L, OrderStatus.COMPLETED)
        );
        when(orderRepository.findByStatus(OrderStatus.PENDING_DELIVERY)).thenReturn(candidates);
        for (Order order : candidates) {
            whenLocked(order);
        }

        int refundedCount = orderService.autoRefundOverdueUndeliveredOrders(NOW);

        assertEquals(0, refundedCount);
        for (Order order : candidates) {
            assertNotNull(order.getStatus());
            assertEquals(EscrowStatus.HELD, order.getEscrowStatus());
            assertEquals("NONE", order.getRefundStatus());
        }
        verify(deliveryRepository, never()).existsByOrderId(any());
        verify(orderRepository, never()).save(any(Order.class));
        verify(orderStatusLogRepository, never()).save(any(OrderStatusLog.class));
    }

    @Test
    void autoRefundRejectsNullNow() {
        assertThrows(BusinessException.class, () -> orderService.autoRefundOverdueUndeliveredOrders(null));
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

    private PaymentRecord paymentRecord(Order order) {
        PaymentRecord paymentRecord = new PaymentRecord();
        paymentRecord.setId(6001L);
        paymentRecord.setPaymentNo("P202606010001");
        paymentRecord.setOrderId(order.getId());
        paymentRecord.setAmountCent(order.getTotalAmountCent());
        paymentRecord.setRefundAmountCent(0L);
        paymentRecord.setPayMethod(OrderService.MOCK_PAY_METHOD);
        paymentRecord.setStatus("SUCCESS");
        paymentRecord.setRequestedAt(LocalDateTime.of(2026, 5, 30, 10, 1));
        paymentRecord.setPaidAt(LocalDateTime.of(2026, 5, 30, 10, 1));
        return paymentRecord;
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
