package com.action.camera.demand.repository;

import com.action.camera.demand.domain.DemandResponse;

import java.util.List;
import java.util.Optional;

public interface DemandResponseRepository {

    Long nextId();

    DemandResponse save(DemandResponse response);

    Optional<DemandResponse> findById(Long id);

    List<DemandResponse> findByDemandId(Long demandId);

    Optional<DemandResponse> findByDemandIdAndProviderId(Long demandId, Long providerId);
}
