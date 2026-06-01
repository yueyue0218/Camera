package com.action.camera.order;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.Result;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.order.controller.OrderController;
import com.action.camera.order.dto.MockPaymentRequest;
import com.action.camera.order.dto.OrderResponse;
import com.action.camera.order.dto.OrderStatusLogResponse;
import com.action.camera.order.dto.PaymentResponse;
import com.action.camera.order.dto.ReworkRequest;
import com.action.camera.order.dto.StatusTransitionRequest;
import com.action.camera.order.dto.StatusTransitionResponse;
import com.action.camera.notification.dto.NotificationCreateRequest;
import com.action.camera.notification.service.NotificationService;
import com.action.camera.order.entity.Order;
import com.action.camera.order.entity.OrderStatusLog;
import com.action.camera.order.entity.PaymentRecord;
import com.action.camera.order.enums.EscrowStatus;
import com.action.camera.order.enums.OrderStatus;
import com.action.camera.order.repository.OrderRepository;
import com.action.camera.order.repository.OrderStatusLogRepository;
import com.action.camera.order.repository.PaymentRecordRepository;
import com.action.camera.order.service.OrderService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderControllerTest {

    private static final Long CUSTOMER_ID = 1001L;
    private static final Long PROVIDER_USER_ID = 2001L;
    private static final Long STRANGER_ID = 3001L;
    private static final Long ORDER_ID = 8001L;
    private static final Long QUOTE_ID = 7001L;
    private static final Long AMOUNT_CENT = 39900L;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private PaymentRecordRepository paymentRecordRepository;

    @Mock
    private OrderStatusLogRepository orderStatusLogRepository;

    @Mock
    private NotificationService notificationService;

    private OrderController orderController;

    private final List<OrderStatusLog> savedLogs = new ArrayList<>();

    @BeforeEach
    void setUp() {
        OrderService orderService = new OrderService(orderRepository, paymentRecordRepository, orderStatusLogRepository);
        ReflectionTestUtils.setField(orderService, "notificationService", notificationService);
        orderController = new OrderController(orderService);
        savedLogs.clear();
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    void customerCanListOwnOrders() {
        UserContext.setUserId(CUSTOMER_ID);
        Order order = order(OrderStatus.PENDING_PAYMENT);
        when(orderRepository.findByCustomerIdOrderByUpdatedAtDesc(CUSTOMER_ID)).thenReturn(List.of(order));
        when(orderRepository.findByProviderUserIdOrderByUpdatedAtDesc(CUSTOMER_ID)).thenReturn(List.of());

        Result<List<OrderResponse>> result = orderController.listMyOrders(null, null);

        assertEquals(1, result.getData().size());
        assertEquals(ORDER_ID, result.getData().get(0).getOrderId());
        assertEquals(AMOUNT_CENT, result.getData().get(0).getAmountCent());
    }

    @Test
    void providerCanListOwnOrdersWithStatusFilter() {
        UserContext.setUserId(PROVIDER_USER_ID);
        Order order = order(OrderStatus.PAID_PENDING_SHOOT);
        when(orderRepository.findByProviderUserIdAndStatusOrderByUpdatedAtDesc(
                PROVIDER_USER_ID, OrderStatus.PAID_PENDING_SHOOT)).thenReturn(List.of(order));

        Result<List<OrderResponse>> result =
                orderController.listMyOrders("provider", OrderStatus.PAID_PENDING_SHOOT);

        assertEquals(1, result.getData().size());
        assertEquals(OrderStatus.PAID_PENDING_SHOOT, result.getData().get(0).getStatus());
    }

    @Test
    void strangerListDoesNotReturnOtherUsersOrders() {
        UserContext.setUserId(STRANGER_ID);
        when(orderRepository.findByCustomerIdOrderByUpdatedAtDesc(STRANGER_ID)).thenReturn(List.of());
        when(orderRepository.findByProviderUserIdOrderByUpdatedAtDesc(STRANGER_ID)).thenReturn(List.of());

        Result<List<OrderResponse>> result = orderController.listMyOrders(null, null);

        assertTrue(result.getData().isEmpty());
    }

    @Test
    void customerAndProviderCanViewOrderDetailButStrangerCannot() {
        Order order = order(OrderStatus.PENDING_PAYMENT);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));

        UserContext.setUserId(CUSTOMER_ID);
        assertEquals(ORDER_ID, orderController.getOrder(ORDER_ID).getData().getOrderId());

        UserContext.setUserId(PROVIDER_USER_ID);
        assertEquals(ORDER_ID, orderController.getOrder(ORDER_ID).getData().getOrderId());

        UserContext.setUserId(STRANGER_ID);
        assertThrows(BusinessException.class, () -> orderController.getOrder(ORDER_ID));
    }

    @Test
    void customerCanMockPayAndFundsAreHeld() {
        UserContext.setUserId(CUSTOMER_ID);
        Order order = order(OrderStatus.PENDING_PAYMENT);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));
        when(paymentRecordRepository.findByOrderId(ORDER_ID))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(paymentRecord()));
        when(paymentRecordRepository.save(any(PaymentRecord.class))).thenAnswer(invocation -> {
            PaymentRecord paymentRecord = invocation.getArgument(0);
            paymentRecord.setId(6001L);
            return paymentRecord;
        });
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(orderStatusLogRepository.save(any(OrderStatusLog.class))).thenAnswer(invocation -> {
            OrderStatusLog log = invocation.getArgument(0);
            log.setId((long) savedLogs.size() + 1);
            savedLogs.add(log);
            return log;
        });

        Result<PaymentResponse> result = orderController.mockPay(ORDER_ID, mockPayRequest(AMOUNT_CENT));

        assertEquals(OrderStatus.PAID_PENDING_SHOOT, result.getData().getOrderStatus());
        assertEquals(EscrowStatus.HELD, result.getData().getEscrowStatus());
        assertEquals(AMOUNT_CENT, result.getData().getAmountCent());
        assertEquals(OrderService.MOCK_PAY_METHOD, result.getData().getPayMethod());
        verify(paymentRecordRepository, times(1)).save(any(PaymentRecord.class));
        verify(orderStatusLogRepository, times(1)).save(any(OrderStatusLog.class));
        ArgumentCaptor<NotificationCreateRequest> notificationCaptor =
                ArgumentCaptor.forClass(NotificationCreateRequest.class);
        verify(notificationService, times(2)).createNotification(notificationCaptor.capture());
        assertEquals(List.of("ORDER_PAID", "ORDER_PAID"),
                notificationCaptor.getAllValues().stream()
                        .map(NotificationCreateRequest::type)
                        .toList());
    }

    @Test
    void providerAndStrangerCannotMockPay() {
        Order order = order(OrderStatus.PENDING_PAYMENT);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));

        UserContext.setUserId(PROVIDER_USER_ID);
        assertThrows(BusinessException.class, () -> orderController.mockPay(ORDER_ID, mockPayRequest(AMOUNT_CENT)));

        UserContext.setUserId(STRANGER_ID);
        assertThrows(BusinessException.class, () -> orderController.mockPay(ORDER_ID, mockPayRequest(AMOUNT_CENT)));

        assertEquals(OrderStatus.PENDING_PAYMENT, order.getStatus());
        assertEquals(EscrowStatus.NOT_PAID, order.getEscrowStatus());
        verify(paymentRecordRepository, never()).save(any(PaymentRecord.class));
    }

    @Test
    void mockPayRejectsWrongAmountOrWrongStatusOrDuplicatePayment() {
        UserContext.setUserId(CUSTOMER_ID);
        Order order = order(OrderStatus.PENDING_PAYMENT);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));

        assertThrows(BusinessException.class, () -> orderController.mockPay(ORDER_ID, mockPayRequest(AMOUNT_CENT + 1)));
        assertEquals(OrderStatus.PENDING_PAYMENT, order.getStatus());
        verify(paymentRecordRepository, never()).save(any(PaymentRecord.class));

        Order paidOrder = order(OrderStatus.PAID_PENDING_SHOOT);
        paidOrder.setEscrowStatus(EscrowStatus.HELD);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(paidOrder));
        assertThrows(BusinessException.class, () -> orderController.mockPay(ORDER_ID, mockPayRequest(AMOUNT_CENT)));

        Order duplicatePaymentOrder = order(OrderStatus.PENDING_PAYMENT);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(duplicatePaymentOrder));
        when(paymentRecordRepository.findByOrderId(ORDER_ID)).thenReturn(Optional.of(paymentRecord()));
        assertThrows(BusinessException.class, () -> orderController.mockPay(ORDER_ID, mockPayRequest(AMOUNT_CENT)));
    }

    @Test
    void providerCanProgressMainShootingAndDeliveryStatuses() {
        UserContext.setUserId(PROVIDER_USER_ID);
        Order order = order(OrderStatus.PAID_PENDING_SHOOT);
        prepareTransitionMocks(order);

        StatusTransitionResponse shooting =
                orderController.changeStatus(ORDER_ID, transitionRequest(OrderStatus.SHOOTING)).getData();
        assertEquals(OrderStatus.PAID_PENDING_SHOOT, shooting.getFromStatus());
        assertEquals(OrderStatus.SHOOTING, shooting.getToStatus());

        StatusTransitionResponse pendingDelivery =
                orderController.changeStatus(ORDER_ID, transitionRequest(OrderStatus.PENDING_DELIVERY)).getData();
        assertEquals(OrderStatus.SHOOTING, pendingDelivery.getFromStatus());
        assertEquals(OrderStatus.PENDING_DELIVERY, pendingDelivery.getToStatus());

        StatusTransitionResponse delivered =
                orderController.changeStatus(ORDER_ID, transitionRequest(OrderStatus.DELIVERED_PENDING_CONFIRM)).getData();
        assertEquals(OrderStatus.PENDING_DELIVERY, delivered.getFromStatus());
        assertEquals(OrderStatus.DELIVERED_PENDING_CONFIRM, delivered.getToStatus());
        verify(orderStatusLogRepository, times(3)).save(any(OrderStatusLog.class));
    }

    @Test
    void customerCannotStartShootingAndProviderCannotConfirmComplete() {
        Order order = order(OrderStatus.PAID_PENDING_SHOOT);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));

        UserContext.setUserId(CUSTOMER_ID);
        assertThrows(BusinessException.class,
                () -> orderController.changeStatus(ORDER_ID, transitionRequest(OrderStatus.SHOOTING)));

        order.setStatus(OrderStatus.DELIVERED_PENDING_CONFIRM);
        UserContext.setUserId(PROVIDER_USER_ID);
        assertThrows(BusinessException.class,
                () -> orderController.changeStatus(ORDER_ID, transitionRequest(OrderStatus.COMPLETED)));

        verify(orderStatusLogRepository, never()).save(any(OrderStatusLog.class));
    }

    @Test
    void customerCanConfirmCompleted() {
        UserContext.setUserId(CUSTOMER_ID);
        Order order = order(OrderStatus.DELIVERED_PENDING_CONFIRM);
        prepareTransitionMocks(order);
        ArgumentCaptor<OrderStatusLog> logCaptor = ArgumentCaptor.forClass(OrderStatusLog.class);

        Result<StatusTransitionResponse> result =
                orderController.changeStatus(ORDER_ID, transitionRequest(OrderStatus.COMPLETED));

        assertEquals(OrderStatus.COMPLETED, result.getData().getToStatus());
        assertEquals("CUSTOMER", result.getData().getOperatorRole());
        assertEquals(OrderStatus.COMPLETED, order.getStatus());
        assertEquals(EscrowStatus.RELEASED, order.getEscrowStatus());
        assertEquals("SETTLED", order.getSettlementStatus());
        assertTrue(order.getCompleteTime() != null);
        assertNull(order.getAutoConfirmTime());
        verify(orderStatusLogRepository, times(1)).save(logCaptor.capture());
        assertEquals(OrderStatus.DELIVERED_PENDING_CONFIRM, logCaptor.getValue().getFromStatus());
        assertEquals(OrderStatus.COMPLETED, logCaptor.getValue().getToStatus());
        assertEquals(CUSTOMER_ID, logCaptor.getValue().getOperatorId());
        assertEquals("CUSTOMER", logCaptor.getValue().getOperatorRole());
        ArgumentCaptor<NotificationCreateRequest> notificationCaptor =
                ArgumentCaptor.forClass(NotificationCreateRequest.class);
        verify(notificationService, times(1)).createNotification(notificationCaptor.capture());
        assertEquals("ORDER_COMPLETED", notificationCaptor.getValue().type());
        assertEquals(PROVIDER_USER_ID, notificationCaptor.getValue().userId());
    }

    @Test
    void customerCanCancelBeforeShooting() {
        UserContext.setUserId(CUSTOMER_ID);
        Order order = order(OrderStatus.PAID_PENDING_SHOOT);
        prepareTransitionMocks(order);

        Result<StatusTransitionResponse> result =
                orderController.changeStatus(ORDER_ID, transitionRequest(OrderStatus.CANCELLED));

        assertEquals(OrderStatus.CANCELLED, result.getData().getToStatus());
        assertEquals("CUSTOMER", result.getData().getOperatorRole());
        assertEquals(OrderStatus.CANCELLED, order.getStatus());
        verify(orderStatusLogRepository, times(1)).save(any(OrderStatusLog.class));
        ArgumentCaptor<NotificationCreateRequest> notificationCaptor =
                ArgumentCaptor.forClass(NotificationCreateRequest.class);
        verify(notificationService, times(2)).createNotification(notificationCaptor.capture());
        assertEquals(List.of("ORDER_CANCELLED", "ORDER_CANCELLED"),
                notificationCaptor.getAllValues().stream()
                        .map(NotificationCreateRequest::type)
                        .toList());
    }

    @Test
    void strangerCannotConfirmCompleted() {
        UserContext.setUserId(STRANGER_ID);
        Order order = order(OrderStatus.DELIVERED_PENDING_CONFIRM);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));

        assertThrows(BusinessException.class,
                () -> orderController.changeStatus(ORDER_ID, transitionRequest(OrderStatus.COMPLETED)));

        assertEquals(OrderStatus.DELIVERED_PENDING_CONFIRM, order.getStatus());
        assertEquals(EscrowStatus.HELD, order.getEscrowStatus());
        assertEquals("NOT_SETTLED", order.getSettlementStatus());
        verify(orderRepository, never()).save(any(Order.class));
        verify(orderStatusLogRepository, never()).save(any(OrderStatusLog.class));
    }

    @Test
    void customerCannotConfirmCompletedFromNonDeliveredPendingConfirmStatuses() {
        for (OrderStatus status : List.of(
                OrderStatus.REWORK_REQUIRED,
                OrderStatus.APPEALING,
                OrderStatus.CANCELLED,
                OrderStatus.REFUNDED
        )) {
            UserContext.setUserId(CUSTOMER_ID);
            Order order = order(status);
            when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));

            assertThrows(BusinessException.class,
                    () -> orderController.changeStatus(ORDER_ID, transitionRequest(OrderStatus.COMPLETED)));

            assertEquals(status, order.getStatus());
            assertEquals(EscrowStatus.HELD, order.getEscrowStatus());
            assertEquals("NOT_SETTLED", order.getSettlementStatus());
            verify(orderRepository, never()).save(any(Order.class));
            verify(orderStatusLogRepository, never()).save(any(OrderStatusLog.class));
        }
    }

    @Test
    void customerCanRequestReworkFromDeliveredPendingConfirm() {
        UserContext.setUserId(CUSTOMER_ID);
        Order order = order(OrderStatus.DELIVERED_PENDING_CONFIRM);
        prepareTransitionMocks(order);
        ArgumentCaptor<OrderStatusLog> logCaptor = ArgumentCaptor.forClass(OrderStatusLog.class);

        Result<StatusTransitionResponse> result = orderController.requestRework(
                ORDER_ID,
                reworkRequest("精修肤色与约定不一致")
        );

        assertEquals(OrderStatus.DELIVERED_PENDING_CONFIRM, result.getData().getFromStatus());
        assertEquals(OrderStatus.REWORK_REQUIRED, result.getData().getToStatus());
        assertEquals("CUSTOMER", result.getData().getOperatorRole());
        assertTrue(result.getData().getReason().contains("精修肤色与约定不一致"));
        verify(orderStatusLogRepository, times(1)).save(logCaptor.capture());
        assertTrue(logCaptor.getValue().getReason().contains("精修肤色与约定不一致"));
    }

    @Test
    void reworkRequestRejectsNonDeliveredPendingConfirmStatus() {
        UserContext.setUserId(CUSTOMER_ID);
        Order order = order(OrderStatus.PENDING_DELIVERY);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));

        assertThrows(BusinessException.class,
                () -> orderController.requestRework(ORDER_ID, reworkRequest("还未交付不能返修")));

        assertEquals(OrderStatus.PENDING_DELIVERY, order.getStatus());
        verify(orderRepository, never()).save(any(Order.class));
        verify(orderStatusLogRepository, never()).save(any(OrderStatusLog.class));
    }

    @Test
    void reworkRequestRejectsProviderAndStranger() {
        Order order = order(OrderStatus.DELIVERED_PENDING_CONFIRM);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));

        UserContext.setUserId(PROVIDER_USER_ID);
        assertThrows(BusinessException.class,
                () -> orderController.requestRework(ORDER_ID, reworkRequest("服务方不能替客户返修")));

        UserContext.setUserId(STRANGER_ID);
        assertThrows(BusinessException.class,
                () -> orderController.requestRework(ORDER_ID, reworkRequest("无关用户不能返修")));

        assertEquals(OrderStatus.DELIVERED_PENDING_CONFIRM, order.getStatus());
        verify(orderRepository, never()).save(any(Order.class));
        verify(orderStatusLogRepository, never()).save(any(OrderStatusLog.class));
    }

    @Test
    void reworkRequestRejectsTooLongReason() {
        UserContext.setUserId(CUSTOMER_ID);
        Order order = order(OrderStatus.DELIVERED_PENDING_CONFIRM);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> orderController.requestRework(ORDER_ID, reworkRequest("x".repeat(201))));

        assertEquals(ErrorCode.VALIDATION_ERROR, exception.getErrorCode());
        assertEquals(OrderStatus.DELIVERED_PENDING_CONFIRM, order.getStatus());
        verify(orderRepository, never()).save(any(Order.class));
        verify(orderStatusLogRepository, never()).save(any(OrderStatusLog.class));
    }

    @Test
    void statusTransitionCannotBypassPaymentOrOpenUnsupportedStatesOrStrangerOperate() {
        Order order = order(OrderStatus.PENDING_PAYMENT);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));

        UserContext.setUserId(CUSTOMER_ID);
        assertThrows(BusinessException.class,
                () -> orderController.changeStatus(ORDER_ID, transitionRequest(OrderStatus.COMPLETED)));
        assertThrows(BusinessException.class,
                () -> orderController.changeStatus(ORDER_ID, transitionRequest(OrderStatus.PAID_PENDING_SHOOT)));

        order.setStatus(OrderStatus.PAID_PENDING_SHOOT);
        UserContext.setUserId(PROVIDER_USER_ID);
        assertThrows(BusinessException.class,
                () -> orderController.changeStatus(ORDER_ID, transitionRequest(OrderStatus.APPEALING)));

        UserContext.setUserId(STRANGER_ID);
        assertThrows(BusinessException.class,
                () -> orderController.changeStatus(ORDER_ID, transitionRequest(OrderStatus.SHOOTING)));

        verify(orderStatusLogRepository, never()).save(any(OrderStatusLog.class));
    }

    @Test
    void genericStatusTransitionRejectsReworkRequiredToPendingDelivery() {
        UserContext.setUserId(PROVIDER_USER_ID);
        Order order = order(OrderStatus.REWORK_REQUIRED);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> orderController.changeStatus(ORDER_ID, transitionRequest(OrderStatus.PENDING_DELIVERY)));

        assertEquals(ErrorCode.STATUS_CONFLICT, exception.getErrorCode());
        assertEquals(OrderStatus.REWORK_REQUIRED, order.getStatus());
        verify(orderRepository, never()).save(any(Order.class));
        verify(orderStatusLogRepository, never()).save(any(OrderStatusLog.class));
    }

    @Test
    void participantsCanListStatusLogsInAscendingOrderButStrangerCannot() {
        Order order = order(OrderStatus.PAID_PENDING_SHOOT);
        OrderStatusLog first = statusLog(OrderStatus.PENDING_PAYMENT, OrderStatus.PAID_PENDING_SHOOT, CUSTOMER_ID);
        first.setId(1L);
        first.setCreatedAt(LocalDateTime.of(2026, 6, 1, 10, 0));
        OrderStatusLog second = statusLog(OrderStatus.PAID_PENDING_SHOOT, OrderStatus.SHOOTING, PROVIDER_USER_ID);
        second.setId(2L);
        second.setCreatedAt(LocalDateTime.of(2026, 6, 1, 11, 0));
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));
        when(orderStatusLogRepository.findByOrderIdOrderByCreatedAtAsc(ORDER_ID))
                .thenReturn(List.of(first, second));

        UserContext.setUserId(CUSTOMER_ID);
        Result<List<OrderStatusLogResponse>> customerResult = orderController.listStatusLogs(ORDER_ID);
        assertEquals(1L, customerResult.getData().get(0).getLogId());
        assertEquals(2L, customerResult.getData().get(1).getLogId());

        UserContext.setUserId(PROVIDER_USER_ID);
        assertEquals(2, orderController.listStatusLogs(ORDER_ID).getData().size());

        UserContext.setUserId(STRANGER_ID);
        assertThrows(BusinessException.class, () -> orderController.listStatusLogs(ORDER_ID));
    }

    private void prepareTransitionMocks(Order order) {
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(orderStatusLogRepository.save(any(OrderStatusLog.class))).thenAnswer(invocation -> {
            OrderStatusLog log = invocation.getArgument(0);
            log.setId((long) savedLogs.size() + 1);
            savedLogs.add(log);
            return log;
        });
        when(orderStatusLogRepository.findByOrderIdOrderByCreatedAtAsc(ORDER_ID)).thenAnswer(invocation -> savedLogs);
    }

    private MockPaymentRequest mockPayRequest(Long amountCent) {
        MockPaymentRequest request = new MockPaymentRequest();
        request.setPayMethod(OrderService.MOCK_PAY_METHOD);
        request.setAmountCent(amountCent);
        return request;
    }

    private StatusTransitionRequest transitionRequest(OrderStatus targetStatus) {
        StatusTransitionRequest request = new StatusTransitionRequest();
        request.setTargetStatus(targetStatus);
        request.setReason("P4 status transition");
        return request;
    }

    private ReworkRequest reworkRequest(String reason) {
        ReworkRequest request = new ReworkRequest();
        request.setReason(reason);
        return request;
    }

    private Order order(OrderStatus status) {
        Order order = new Order();
        order.setId(ORDER_ID);
        order.setOrderNo("O202606010001");
        order.setQuoteId(QUOTE_ID);
        order.setConversationId(9001L);
        order.setCustomerId(CUSTOMER_ID);
        order.setProviderUserId(PROVIDER_USER_ID);
        order.setStatus(status);
        order.setEscrowStatus(status == OrderStatus.PENDING_PAYMENT ? EscrowStatus.NOT_PAID : EscrowStatus.HELD);
        order.setSettlementStatus("NOT_SETTLED");
        order.setRefundStatus("NONE");
        order.setTotalAmountCent(AMOUNT_CENT);
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

    private PaymentRecord paymentRecord() {
        PaymentRecord paymentRecord = new PaymentRecord();
        paymentRecord.setId(6001L);
        paymentRecord.setPaymentNo("P202606010001");
        paymentRecord.setOrderId(ORDER_ID);
        paymentRecord.setAmountCent(AMOUNT_CENT);
        paymentRecord.setRefundAmountCent(0L);
        paymentRecord.setPayMethod(OrderService.MOCK_PAY_METHOD);
        paymentRecord.setStatus("SUCCESS");
        paymentRecord.setRequestedAt(LocalDateTime.of(2026, 5, 30, 10, 1));
        paymentRecord.setPaidAt(LocalDateTime.of(2026, 5, 30, 10, 1));
        return paymentRecord;
    }

    private OrderStatusLog statusLog(OrderStatus from, OrderStatus to, Long operatorId) {
        OrderStatusLog log = new OrderStatusLog();
        log.setOrderId(ORDER_ID);
        log.setFromStatus(from);
        log.setToStatus(to);
        log.setOperatorId(operatorId);
        log.setOperatorRole(operatorId.equals(CUSTOMER_ID) ? "CUSTOMER" : "PROVIDER");
        log.setReason("P4 status transition");
        log.setCreatedAt(LocalDateTime.now());
        return log;
    }
}
