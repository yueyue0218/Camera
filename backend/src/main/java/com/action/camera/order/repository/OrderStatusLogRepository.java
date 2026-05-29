package com.action.camera.order.repository;

import com.action.camera.order.entity.OrderStatusLog;
import com.action.camera.order.enums.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OrderStatusLogRepository extends JpaRepository<OrderStatusLog, Long> {

    List<OrderStatusLog> findByOrderIdOrderByCreatedAtAsc(Long orderId);

    Optional<OrderStatusLog> findFirstByOrderIdAndToStatusOrderByCreatedAtDesc(Long orderId, OrderStatus toStatus);
}
