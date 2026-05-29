package com.action.camera.admin.repository;

import com.action.camera.admin.entity.RealNameCertification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RealNameCertificationRepository extends JpaRepository<RealNameCertification, Long> {

    List<RealNameCertification> findByStatusOrderByAppliedAtAsc(String status);

    long countByStatus(String status);
}
