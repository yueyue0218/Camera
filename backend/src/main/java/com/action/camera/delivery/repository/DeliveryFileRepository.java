package com.action.camera.delivery.repository;

import com.action.camera.delivery.entity.DeliveryFile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DeliveryFileRepository extends JpaRepository<DeliveryFile, Long> {

    Optional<DeliveryFile> findFirstByDeliveryIdOrderBySortOrderAsc(Long deliveryId);
}
