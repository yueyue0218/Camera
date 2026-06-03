package com.action.camera.servicepackage.repository;

import com.action.camera.servicepackage.domain.ServicePackage;
import com.action.camera.servicepackage.domain.ServicePackageStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ServicePackageRepository extends JpaRepository<ServicePackage, Long> {

    List<ServicePackage> findByStatus(ServicePackageStatus status);

    Optional<ServicePackage> findByIdAndProviderId(Long id, Long providerId);

    @Query("""
            select s from ServicePackage s
            where s.providerId = :providerId
              and s.hiddenByProvider = false
            order by s.updatedAt desc, s.id desc
            """)
    List<ServicePackage> findOwnerHistory(@Param("providerId") Long providerId);
}
