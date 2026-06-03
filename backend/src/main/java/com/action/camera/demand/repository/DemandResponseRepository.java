package com.action.camera.demand.repository;

import com.action.camera.demand.domain.DemandResponse;
import com.action.camera.demand.domain.DemandResponseStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DemandResponseRepository extends JpaRepository<DemandResponse, Long> {

    @Query("""
            select r from DemandResponse r
            where r.demandId = :demandId
            order by r.responseTime desc, r.id desc
            """)
    List<DemandResponse> findByDemandId(@Param("demandId") Long demandId);

    @Query("""
            select r from DemandResponse r
            where r.providerId = :providerId
            order by r.responseTime desc, r.id desc
            """)
    List<DemandResponse> findByProviderIdOrderByResponseTimeDesc(@Param("providerId") Long providerId);

    Optional<DemandResponse> findByDemandIdAndProviderId(Long demandId, Long providerId);

    long countByDemandIdAndStatus(Long demandId, DemandResponseStatus status);
}
