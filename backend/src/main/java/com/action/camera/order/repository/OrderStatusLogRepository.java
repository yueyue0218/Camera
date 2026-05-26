package com.action.camera.order.repository;

import com.action.camera.order.entity.OrderStatusLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrderStatusLogRepository extends JpaRepository<OrderStatusLog, Long> {

    List<OrderStatusLog> findByOrderIdOrderByCreatedAtAsc(Long orderId);
}
