package com.action.camera.delivery.repository;

import com.action.camera.delivery.entity.DeliveryFile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DeliveryFileRepository extends JpaRepository<DeliveryFile, Long> {

    Optional<DeliveryFile> findFirstByDeliveryIdOrderBySortOrderAsc(Long deliveryId);

    List<DeliveryFile> findByDeliveryIdInAndFileIdIn(Collection<Long> deliveryIds, Collection<Long> fileIds);

    void deleteByDeliveryId(Long deliveryId);
}
