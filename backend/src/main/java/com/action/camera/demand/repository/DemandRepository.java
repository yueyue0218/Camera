package com.action.camera.demand.repository;

import com.action.camera.admin.domain.ModerationStatus;
import com.action.camera.demand.domain.Demand;
import com.action.camera.demand.domain.DemandStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DemandRepository extends JpaRepository<Demand, Long> {

    List<Demand> findByStatus(DemandStatus status);

    long countByModerationStatus(ModerationStatus moderationStatus);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from Demand d where d.id = :id")
    Optional<Demand> findByIdForUpdate(@Param("id") Long id);

    @Query("""
            select d from Demand d
            where d.customerId = :customerId
              and d.status in :statuses
              and d.hiddenByCustomer = false
            order by d.updatedAt desc, d.id desc
            """)
    List<Demand> findOwnerHistory(@Param("customerId") Long customerId,
                                  @Param("statuses") Collection<DemandStatus> statuses);
}
