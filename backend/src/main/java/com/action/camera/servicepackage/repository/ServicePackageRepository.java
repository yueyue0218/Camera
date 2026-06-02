package com.action.camera.servicepackage.repository;

import com.action.camera.servicepackage.domain.ServicePackage;
import com.action.camera.servicepackage.domain.ServicePackageStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ServicePackageRepository extends JpaRepository<ServicePackage, Long> {

    List<ServicePackage> findByStatus(ServicePackageStatus status);
}
