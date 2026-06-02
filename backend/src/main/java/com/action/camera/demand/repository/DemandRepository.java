package com.action.camera.demand.repository;

import com.action.camera.demand.domain.Demand;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DemandRepository extends JpaRepository<Demand, Long> {
}
