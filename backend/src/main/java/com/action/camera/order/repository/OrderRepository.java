package com.action.camera.order.repository;

import com.action.camera.order.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {

    Optional<Order> findByQuoteId(Long quoteId);
}
