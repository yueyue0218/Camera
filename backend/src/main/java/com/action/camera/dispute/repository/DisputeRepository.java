package com.action.camera.dispute.repository;

import com.action.camera.dispute.entity.Dispute;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface DisputeRepository extends JpaRepository<Dispute, Long> {

    List<Dispute> findByOrderId(Long orderId);

    List<Dispute> findByInitiatorId(Long initiatorId);

    boolean existsByOrderIdAndStatusIn(Long orderId, List<String> statuses);

    @Query("""
            select count(d)
            from Dispute d
            join Order o on o.id = d.orderId
            where d.status = 'RESOLVED'
              and (
                (o.customerId = :userId and d.responsibility in ('CUSTOMER_FAULT', 'BOTH_FAULT'))
                or (o.providerUserId = :userId and d.responsibility in ('PROVIDER_FAULT', 'BOTH_FAULT'))
              )
            """)
    long countResponsibleResolvedDisputesForUser(@Param("userId") Long userId);
}
