package com.action.camera.demand.repository;

import com.action.camera.demand.domain.Demand;
import com.action.camera.demand.domain.DemandStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface DemandRepository extends JpaRepository<Demand, Long> {

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
