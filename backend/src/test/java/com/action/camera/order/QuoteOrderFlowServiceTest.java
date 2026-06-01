package com.action.camera.order;

import com.action.camera.common.exception.BusinessException;
import com.action.camera.message.entity.Quote;
import com.action.camera.message.enums.QuoteStatus;
import com.action.camera.message.repository.ConversationRepository;
import com.action.camera.message.repository.QuoteRepository;
import com.action.camera.message.service.QuoteService;
import com.action.camera.order.dto.OrderResponse;
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
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class QuoteOrderFlowServiceTest {

    private static final Long CUSTOMER_ID = 1001L;
    private static final Long PROVIDER_USER_ID = 2001L;
    private static final Long QUOTE_ID = 7001L;
    private static final Long ORDER_ID = 8001L;
    private static final Long AMOUNT_CENT = 39900L;
    private static final Long SERVICE_PACKAGE_ID = 9101L;

    @Mock
    private QuoteRepository quoteRepository;

    @Mock
    private ConversationRepository conversationRepository;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private PaymentRecordRepository paymentRecordRepository;

    @Mock
    private OrderStatusLogRepository orderStatusLogRepository;

    private QuoteService quoteService;

    private OrderService orderService;

    @BeforeEach
    void setUp() {
        orderService = new OrderService(orderRepository, paymentRecordRepository, orderStatusLogRepository);
        quoteService = new QuoteService(quoteRepository, conversationRepository, orderService);
    }

    @Test
    void customerCanConfirmPendingQuoteAndGenerateOrder() {
        Quote quote = pendingQuote();
        when(quoteRepository.findById(QUOTE_ID)).thenReturn(Optional.of(quote));
        when(quoteRepository.save(any(Quote.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(orderRepository.findByQuoteId(QUOTE_ID)).thenReturn(Optional.empty());
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
            Order order = invocation.getArgument(0);
            order.setId(ORDER_ID);
            return order;
        });

        Order order = quoteService.confirmQuote(QUOTE_ID, CUSTOMER_ID, "确认报价");

        assertQuoteHasSqlRequiredFields(quote);
        assertEquals(QuoteStatus.CONFIRMED, quote.getStatus());
        assertEquals(OrderStatus.PENDING_PAYMENT, order.getStatus());
        assertEquals(EscrowStatus.NOT_PAID, order.getEscrowStatus());
        assertEquals(AMOUNT_CENT, order.getTotalAmountCent());
        assertEquals(CUSTOMER_ID, order.getCustomerId());
        assertEquals(PROVIDER_USER_ID, order.getProviderUserId());
        assertEquals(QUOTE_ID, order.getQuoteId());
        assertEquals(quote.getShootStartTime(), order.getShootStartTime());
        assertEquals(quote.getShootEndTime(), order.getShootEndTime());
        assertEquals(quote.getLocation(), order.getShootLocation());
        assertEquals(quote.getDeliveryDeadline(), order.getDeliveryDeadline());
        assertEquals(quote.getPhotoUsageScope(), order.getPhotoUsageScope());
        assertEquals(quote.getAmountCent(), order.getProviderIncomeCent());
        assertEquals(0L, order.getPlatformFeeCent());
        assertNotNull(order.getQuoteSnapshotJson());
        assertTrue(order.getQuoteSnapshotJson().contains("\"quoteId\":" + QUOTE_ID));
        verify(orderRepository, times(1)).save(any(Order.class));
    }

    @Test
    void servicePackageQuoteGeneratesOrderWithPersistedServicePackageIdAndResponseField() {
        Quote quote = pendingQuote();
        quote.setSourceType("SERVICE_PACKAGE");
        quote.setSourceId(SERVICE_PACKAGE_ID);
        when(quoteRepository.findById(QUOTE_ID)).thenReturn(Optional.of(quote));
        when(quoteRepository.save(any(Quote.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(orderRepository.findByQuoteId(QUOTE_ID)).thenReturn(Optional.empty());
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
            Order order = invocation.getArgument(0);
            order.setId(ORDER_ID);
            return order;
        });

        Order order = quoteService.confirmQuote(QUOTE_ID, CUSTOMER_ID, "确认服务包报价");
        OrderResponse response = OrderResponse.from(order);

        assertEquals(SERVICE_PACKAGE_ID, order.getServicePackageId());
        assertEquals(SERVICE_PACKAGE_ID, response.getServicePackageId());
    }

    @Test
    void completedOrderProviderValidationSucceedsOnlyForCompletedOwnerOrder() {
        Order completedOrder = pendingPaymentOrder();
        completedOrder.setStatus(OrderStatus.COMPLETED);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(completedOrder));

        Order validatedOrder = orderService.validateCompletedProviderOrder(ORDER_ID, PROVIDER_USER_ID);

        assertSame(completedOrder, validatedOrder);
    }

    @Test
    void completedOrderProviderValidationRejectsNonCompletedMismatchedAndMissingOrders() {
        Order nonCompletedOrder = pendingPaymentOrder();
        nonCompletedOrder.setStatus(OrderStatus.DELIVERED_PENDING_CONFIRM);
        when(orderRepository.findById(ORDER_ID))
                .thenReturn(Optional.of(nonCompletedOrder))
                .thenReturn(Optional.of(pendingPaymentOrder()))
                .thenReturn(Optional.empty());

        assertThrows(BusinessException.class,
                () -> orderService.validateCompletedProviderOrder(ORDER_ID, PROVIDER_USER_ID));
        assertThrows(BusinessException.class,
                () -> orderService.validateCompletedProviderOrder(ORDER_ID, 9999L));
        assertThrows(BusinessException.class,
                () -> orderService.validateCompletedProviderOrder(ORDER_ID, PROVIDER_USER_ID));
    }

    @Test
    void providerCannotConfirmOwnQuote() {
        Quote quote = pendingQuote();
        when(quoteRepository.findById(QUOTE_ID)).thenReturn(Optional.of(quote));

        assertThrows(BusinessException.class,
                () -> quoteService.confirmQuote(QUOTE_ID, PROVIDER_USER_ID, "服务方不能确认"));

        assertEquals(QuoteStatus.PENDING_CONFIRM, quote.getStatus());
        verify(orderRepository, never()).save(any(Order.class));
    }

    @Test
    void confirmingSameQuoteTwiceDoesNotCreateDuplicateOrder() {
        Quote quote = pendingQuote();
        AtomicReference<Order> storedOrder = new AtomicReference<>();

        when(quoteRepository.findById(QUOTE_ID)).thenReturn(Optional.of(quote));
        when(quoteRepository.save(any(Quote.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(orderRepository.findByQuoteId(QUOTE_ID)).thenAnswer(invocation -> Optional.ofNullable(storedOrder.get()));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
            Order order = invocation.getArgument(0);
            order.setId(ORDER_ID);
            storedOrder.set(order);
            return order;
        });

        Order firstOrder = quoteService.confirmQuote(QUOTE_ID, CUSTOMER_ID, "第一次确认");
        Order secondOrder = quoteService.confirmQuote(QUOTE_ID, CUSTOMER_ID, "重复确认");

        assertSame(firstOrder, secondOrder);
        assertEquals(QuoteStatus.CONFIRMED, quote.getStatus());
        verify(orderRepository, times(1)).save(any(Order.class));
    }

    @Test
    void rejectedQuoteCannotBeConfirmedAgain() {
        Quote quote = pendingQuote();
        when(quoteRepository.findById(QUOTE_ID)).thenReturn(Optional.of(quote));
        when(quoteRepository.save(any(Quote.class))).thenAnswer(invocation -> invocation.getArgument(0));

        quoteService.rejectQuote(QUOTE_ID, CUSTOMER_ID, "不接受该报价");

        assertEquals(QuoteStatus.REJECTED, quote.getStatus());
        assertThrows(BusinessException.class,
                () -> quoteService.confirmQuote(QUOTE_ID, CUSTOMER_ID, "尝试确认已拒绝报价"));
        verify(orderRepository, never()).save(any(Order.class));
    }

    @Test
    void mockPayHoldsFundsAndWritesPaymentRecordAndStatusLog() {
        Order order = pendingPaymentOrder();
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));
        when(paymentRecordRepository.findByOrderId(ORDER_ID)).thenReturn(Optional.empty());
        when(paymentRecordRepository.save(any(PaymentRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(orderStatusLogRepository.save(any(OrderStatusLog.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Order paidOrder = orderService.mockPay(ORDER_ID, CUSTOMER_ID, AMOUNT_CENT);

        ArgumentCaptor<PaymentRecord> paymentCaptor = ArgumentCaptor.forClass(PaymentRecord.class);
        ArgumentCaptor<OrderStatusLog> logCaptor = ArgumentCaptor.forClass(OrderStatusLog.class);
        assertEquals(OrderStatus.PAID_PENDING_SHOOT, paidOrder.getStatus());
        assertEquals(EscrowStatus.HELD, paidOrder.getEscrowStatus());
        verify(paymentRecordRepository, times(1)).save(paymentCaptor.capture());
        verify(orderStatusLogRepository, times(1)).save(logCaptor.capture());

        PaymentRecord paymentRecord = paymentCaptor.getValue();
        assertEquals(AMOUNT_CENT, paymentRecord.getAmountCent());
        assertEquals(0L, paymentRecord.getRefundAmountCent());
        assertEquals(OrderService.MOCK_PAY_METHOD, paymentRecord.getPayMethod());
        assertNotNull(paymentRecord.getRequestedAt());
        assertNotNull(paymentRecord.getPaidAt());

        OrderStatusLog statusLog = logCaptor.getValue();
        assertEquals(OrderStatus.PENDING_PAYMENT, statusLog.getFromStatus());
        assertEquals(OrderStatus.PAID_PENDING_SHOOT, statusLog.getToStatus());
        assertEquals("模拟支付成功，资金进入平台托管", statusLog.getRemark());
    }

    @Test
    void nonCustomerCannotPayOrder() {
        Order order = pendingPaymentOrder();
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));

        assertThrows(BusinessException.class,
                () -> orderService.mockPay(ORDER_ID, PROVIDER_USER_ID, AMOUNT_CENT));

        assertEquals(OrderStatus.PENDING_PAYMENT, order.getStatus());
        assertEquals(EscrowStatus.NOT_PAID, order.getEscrowStatus());
        verify(paymentRecordRepository, never()).save(any(PaymentRecord.class));
        verify(orderStatusLogRepository, never()).save(any(OrderStatusLog.class));
    }

    @Test
    void mismatchedPaymentAmountFails() {
        Order order = pendingPaymentOrder();
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));

        assertThrows(BusinessException.class,
                () -> orderService.mockPay(ORDER_ID, CUSTOMER_ID, AMOUNT_CENT + 1));

        assertEquals(OrderStatus.PENDING_PAYMENT, order.getStatus());
        assertEquals(EscrowStatus.NOT_PAID, order.getEscrowStatus());
        verify(paymentRecordRepository, never()).save(any(PaymentRecord.class));
        verify(orderStatusLogRepository, never()).save(any(OrderStatusLog.class));
    }

    @Test
    void illegalStatusTransitionIsBlocked() {
        Order order = pendingPaymentOrder();
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order));

        assertThrows(BusinessException.class,
                () -> orderService.changeStatus(ORDER_ID, CUSTOMER_ID, OrderStatus.COMPLETED, "不能直接完成"));

        assertEquals(OrderStatus.PENDING_PAYMENT, order.getStatus());
        verify(orderRepository, never()).save(any(Order.class));
        verify(orderStatusLogRepository, never()).save(any(OrderStatusLog.class));
    }

    private Quote pendingQuote() {
        Quote quote = new Quote();
        quote.setId(QUOTE_ID);
        quote.setQuoteNo("Q202605220001");
        quote.setConversationId(9001L);
        quote.setSourceType("DEMAND_RESPONSE");
        quote.setSourceId(3001L);
        quote.setCustomerId(CUSTOMER_ID);
        quote.setProviderUserId(PROVIDER_USER_ID);
        quote.setShootingPlanId(6001L);
        quote.setAmountCent(AMOUNT_CENT);
        quote.setShootStartTime(LocalDateTime.of(2026, 6, 1, 9, 0));
        quote.setShootEndTime(LocalDateTime.of(2026, 6, 1, 12, 0));
        quote.setLocation("南京大学鼓楼校区");
        quote.setServiceContent("毕业照半日约拍");
        quote.setOriginalCount(30);
        quote.setRefinedCount(9);
        quote.setDeliveryDeadline(LocalDateTime.of(2026, 6, 8, 12, 0));
        quote.setPhotoUsageScope("PERSONAL_ONLY");
        quote.setTerms("P4 简化报价条款");
        quote.setContractTerms("P4 简化合同条款");
        quote.setSafetyNoticeVersion("P4-DEMO");
        quote.setServiceSnapshotJson("{\"scene\":\"graduation\"}");
        quote.setDeliveryDays(7);
        quote.setRemark("含基础调色");
        quote.setStatus(QuoteStatus.PENDING_CONFIRM);
        quote.setExpireTime(LocalDateTime.of(2026, 5, 30, 23, 59));
        quote.setCreatedAt(LocalDateTime.now());
        quote.setUpdatedAt(LocalDateTime.now());
        return quote;
    }

    private Order pendingPaymentOrder() {
        Order order = new Order();
        order.setId(ORDER_ID);
        order.setOrderNo("O202605220001");
        order.setQuoteId(QUOTE_ID);
        order.setConversationId(9001L);
        order.setCustomerId(CUSTOMER_ID);
        order.setProviderUserId(PROVIDER_USER_ID);
        order.setShootingPlanId(6001L);
        order.setSourceType("DEMAND_RESPONSE");
        order.setSourceId(3001L);
        order.setStatus(OrderStatus.PENDING_PAYMENT);
        order.setEscrowStatus(EscrowStatus.NOT_PAID);
        order.setSettlementStatus("NOT_SETTLED");
        order.setRefundStatus("NONE");
        order.setTotalAmountCent(AMOUNT_CENT);
        order.setPlatformFeeCent(0L);
        order.setProviderIncomeCent(AMOUNT_CENT);
        order.setShootStartTime(LocalDateTime.of(2026, 6, 1, 9, 0));
        order.setShootEndTime(LocalDateTime.of(2026, 6, 1, 12, 0));
        order.setShootLocation("南京大学鼓楼校区");
        order.setDeliveryDeadline(LocalDateTime.of(2026, 6, 8, 12, 0));
        order.setPhotoUsageScope("PERSONAL_ONLY");
        order.setQuoteSnapshotJson("{}");
        order.setSafetyNoticeConfirmed(false);
        order.setContractTerms("P4 简化合同条款");
        order.setCreatedAt(LocalDateTime.now());
        order.setUpdatedAt(LocalDateTime.now());
        assertNotNull(order.getId());
        return order;
    }

    private void assertQuoteHasSqlRequiredFields(Quote quote) {
        assertNotNull(quote.getQuoteNo());
        assertNotNull(quote.getConversationId());
        assertNotNull(quote.getProviderUserId());
        assertNotNull(quote.getCustomerId());
        assertNotNull(quote.getSourceType());
        assertNotNull(quote.getShootStartTime());
        assertNotNull(quote.getShootEndTime());
        assertNotNull(quote.getLocation());
        assertNotNull(quote.getOriginalCount());
        assertNotNull(quote.getRefinedCount());
        assertNotNull(quote.getDeliveryDeadline());
        assertNotNull(quote.getPhotoUsageScope());
        assertNotNull(quote.getServiceSnapshotJson());
        assertNotNull(quote.getAmountCent());
        assertNotNull(quote.getStatus());
        assertNotNull(quote.getExpireTime());
        assertNotNull(quote.getCreatedAt());
        assertNotNull(quote.getUpdatedAt());
    }
}
