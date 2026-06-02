package com.action.camera.servicepackage.repository;

import com.action.camera.servicepackage.domain.ServicePackageInterest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ServicePackageInterestRepository extends JpaRepository<ServicePackageInterest, Long> {

    Optional<ServicePackageInterest> findByUserIdAndServicePackageId(Long userId, Long servicePackageId);

    boolean existsByUserIdAndServicePackageId(Long userId, Long servicePackageId);

    void deleteByUserIdAndServicePackageId(Long userId, Long servicePackageId);

    List<ServicePackageInterest> findByUserIdOrderByCreatedAtDesc(Long userId);
}
