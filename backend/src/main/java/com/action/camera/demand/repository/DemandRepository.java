package com.action.camera.demand.repository;

import com.action.camera.demand.domain.Demand;

import java.util.List;
import java.util.Optional;

public interface DemandRepository {

    Long nextId();

    Demand save(Demand demand);

    Optional<Demand> findById(Long id);

    List<Demand> findAll();

    void deleteById(Long id);
}
