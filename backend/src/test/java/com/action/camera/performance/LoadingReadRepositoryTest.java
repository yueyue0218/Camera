package com.action.camera.performance;

import com.action.camera.application.OrderDisplayService;
import com.action.camera.application.UserDisplayService;
import com.action.camera.delivery.repository.DeliveryRepository;
import com.action.camera.notification.service.NotificationService;
import com.action.camera.order.entity.Order;
import com.action.camera.order.enums.OrderStatus;
import com.action.camera.order.repository.OrderRepository;
import com.action.camera.order.repository.OrderStatusLogRepository;
import com.action.camera.order.repository.PaymentRecordRepository;
import com.action.camera.order.service.OrderService;
import com.action.camera.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

/** H2 correctness/query-shape tests, not a MySQL or online performance benchmark. */
@DataJpaTest(properties = {"spring.jpa.defer-datasource-initialization=true", "spring.jpa.show-sql=false",
        "spring.jpa.properties.hibernate.generate_statistics=true"})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class LoadingReadRepositoryTest {
    @Autowired OrderRepository orders;
    @Autowired OrderStatusLogRepository logs;
    @Autowired EntityManager entityManager;

    private OrderService orderService() {
        OrderService service = new OrderService(orders, mock(PaymentRecordRepository.class), logs,
                mock(DeliveryRepository.class), mock(UserDisplayService.class), mock(OrderDisplayService.class), mock(UserRepository.class));
        ReflectionTestUtils.setField(service, "notificationService", mock(NotificationService.class));
        return service;
    }

    @Test
    void summaryMatchesEveryActualStatusAndSeparatesCustomerProviderAndAccountsWithoutLoadingHistory() {
        for (int i = 0; i < OrderStatus.values().length; i++) {
            orders.save(order(7L, 8L, OrderStatus.values()[i], i));
        }
        orders.save(order(9L, 7L, OrderStatus.COMPLETED, 100)); orders.flush(); entityManager.clear();
        var stats = entityManager.getEntityManagerFactory().unwrap(SessionFactory.class).getStatistics(); stats.clear();
        var summary = orderService().summarizeMyOrders(7L, "customer");
        assertThat(summary.total()).isEqualTo(10); assertThat(summary.completed()).isEqualTo(1);
        assertThat(summary.ongoing()).isEqualTo(7); assertThat(summary.byStatus().values()).containsOnly(1L);
        assertThat(stats.getEntityLoadCount()).isZero();
        assertThat(stats.getPrepareStatementCount()).isEqualTo(2);
        assertThat(orderService().summarizeMyOrders(7L, "provider").total()).isEqualTo(1);
        assertThat(orderService().summarizeMyOrders(99L, "customer").total()).isZero();
        assertThatThrownBy(() -> orderService().summarizeMyOrders(null, "customer")).isInstanceOf(RuntimeException.class);
        assertThatThrownBy(() -> orderService().summarizeMyOrders(7L, "admin")).isInstanceOf(RuntimeException.class);
    }

    @Test
    void summaryAndPagePreserveReadSideTimelineTransitionsIncludingOrdersOutsideThePage() {
        Order due = order(7L, 8L, OrderStatus.PAID_PENDING_SHOOT, 1);
        due.setShootStartTime(LocalDateTime.now().minusHours(3)); due.setShootEndTime(LocalDateTime.now().minusHours(1));
        orders.saveAndFlush(due);
        var summary = orderService().summarizeMyOrders(7L, "customer");
        assertThat(summary.byStatus().get("PENDING_DELIVERY")).isEqualTo(1);
        assertThat(summary.byStatus().get("PAID_PENDING_SHOOT")).isZero();
        assertThat(logs.findByOrderIdOrderByCreatedAtAsc(due.getId())).hasSize(2);
        assertThat(orderService().summarizeMyOrders(7L, "customer").total()).isEqualTo(1);
        assertThat(logs.findByOrderIdOrderByCreatedAtAsc(due.getId())).hasSize(2);
    }

    @Test
    void orderPagesMatchLegacyWithRoleStatusDeepAndEmptyPages() {
        IntStream.range(0, 23).forEach(i -> orders.save(order(7L, 8L, OrderStatus.COMPLETED, i)));
        orders.saveAndFlush(order(9L, 7L, OrderStatus.CANCELLED, 99));
        OrderService service = orderService();
        var legacy = service.listMyOrders(7L, "customer", null).stream().map(Order::getId).toList();
        List<Long> ids = new ArrayList<>();
        for (int page = 1; page <= 3; page++) {
            var result = service.pageMyOrders(7L, "customer", null, page, 10);
            assertThat(result.getTotal()).isEqualTo(23); ids.addAll(result.getRecords().stream().map(Order::getId).toList());
        }
        assertThat(ids).isEqualTo(legacy).doesNotHaveDuplicates();
        assertThat(service.pageMyOrders(7L, "provider", OrderStatus.CANCELLED, 1, 10).getTotal()).isEqualTo(1);
        assertThat(service.pageMyOrders(7L, "customer", OrderStatus.CANCELLED, 1, 10).getTotal()).isZero();
        assertThat(service.pageMyOrders(7L, "customer", null, 9, 10).getRecords()).isEmpty();
    }

    private Order order(long customer, long provider, OrderStatus status, int sequence) {
        Order order = new Order(); order.setOrderNo("fixture-" + sequence); order.setQuoteId(1000L + sequence);
        order.setConversationId(100L); order.setCustomerId(customer); order.setProviderUserId(provider);
        order.setStatus(status); order.setTotalAmountCent(10000L); order.setQuoteSnapshotJson("{}");
        order.setShootStartTime(LocalDateTime.now().plusDays(1)); order.setShootEndTime(LocalDateTime.now().plusDays(2));
        order.setDeliveryDeadline(LocalDateTime.now().plusDays(3)); order.setShootLocation("fixture");
        order.setUpdatedAt(LocalDateTime.of(2026, 1, 1, 0, 0).plusMinutes(sequence));
        return order;
    }
}
