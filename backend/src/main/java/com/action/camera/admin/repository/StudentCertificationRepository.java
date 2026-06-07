package com.action.camera.admin.repository;

import com.action.camera.admin.entity.StudentCertification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StudentCertificationRepository extends JpaRepository<StudentCertification, Long> {

    List<StudentCertification> findByStatusOrderByAppliedAtAsc(String status);

    long countByStatus(String status);
}
