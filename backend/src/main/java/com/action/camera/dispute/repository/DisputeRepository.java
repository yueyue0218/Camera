package com.action.camera.dispute.repository;

import com.action.camera.credit.repository.UserCountAggregate;
import com.action.camera.dispute.entity.Dispute;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
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

    @Query(value = """
            select risk.user_id as userId, count(*) as aggregateCount
            from (
                select o.customer_id as user_id, d.id as dispute_id
                from disputes d
                join orders o on o.id = d.order_id
                where d.status = 'RESOLVED'
                  and d.responsibility in ('CUSTOMER_FAULT', 'BOTH_FAULT')
                  and o.customer_id in (:userIds)
                union
                select o.provider_user_id as user_id, d.id as dispute_id
                from disputes d
                join orders o on o.id = d.order_id
                where d.status = 'RESOLVED'
                  and d.responsibility in ('PROVIDER_FAULT', 'BOTH_FAULT')
                  and o.provider_user_id in (:userIds)
            ) risk
            group by risk.user_id
            """, nativeQuery = true)
    List<UserCountAggregate> findResponsibleResolvedDisputeCounts(@Param("userIds") Collection<Long> userIds);
}
