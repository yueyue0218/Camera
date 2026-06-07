package com.action.camera.dispute.repository;

import com.action.camera.dispute.entity.Dispute;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DisputeRepository extends JpaRepository<Dispute, Long> {

    List<Dispute> findByOrderId(Long orderId);

    List<Dispute> findByInitiatorId(Long initiatorId);

    boolean existsByOrderIdAndStatusIn(Long orderId, List<String> statuses);
}
