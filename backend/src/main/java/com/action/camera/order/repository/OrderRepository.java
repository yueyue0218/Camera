package com.action.camera.order.repository;

import com.action.camera.order.entity.Order;
import com.action.camera.order.enums.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {

    Optional<Order> findByQuoteId(Long quoteId);

    List<Order> findByCustomerIdOrderByUpdatedAtDesc(Long customerId);

    List<Order> findByProviderUserIdOrderByUpdatedAtDesc(Long providerUserId);

    List<Order> findByCustomerIdAndStatusOrderByUpdatedAtDesc(Long customerId, OrderStatus status);

    List<Order> findByProviderUserIdAndStatusOrderByUpdatedAtDesc(Long providerUserId, OrderStatus status);

    List<Order> findByStatus(OrderStatus status);
}
