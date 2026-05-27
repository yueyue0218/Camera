package com.action.camera.delivery.repository;

import com.action.camera.delivery.entity.Delivery;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DeliveryRepository extends JpaRepository<Delivery, Long> {

    List<Delivery> findByOrderIdOrderByUploadTimeDesc(Long orderId);
}
