package com.action.camera.servicepackage.repository;

import com.action.camera.servicepackage.domain.ServicePackageInterest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ServicePackageInterestRepository extends JpaRepository<ServicePackageInterest, Long> {

    Optional<ServicePackageInterest> findByUserIdAndServicePackageId(Long userId, Long servicePackageId);

    boolean existsByUserIdAndServicePackageId(Long userId, Long servicePackageId);

    void deleteByUserIdAndServicePackageId(Long userId, Long servicePackageId);

    @Query("select i from ServicePackageInterest i where i.userId = :userId and i.targetType = 'SERVICE_PACKAGE' order by i.createdAt desc, i.id desc")
    List<ServicePackageInterest> findByUserIdOrderByCreatedAtDesc(@Param("userId") Long userId);

    @Query("select i from ServicePackageInterest i where i.userId = :userId and i.targetType = 'SERVICE_PACKAGE' and i.createdAt >= :createdAt order by i.createdAt desc, i.id desc")
    List<ServicePackageInterest> findByUserIdAndCreatedAtGreaterThanEqualOrderByCreatedAtDesc(
            @Param("userId") Long userId, @Param("createdAt") LocalDateTime createdAt, Pageable pageable);

    Optional<ServicePackageInterest> findByUserIdAndDemandIdAndTargetType(Long userId, Long demandId, String targetType);

    void deleteByUserIdAndDemandIdAndTargetType(Long userId, Long demandId, String targetType);

    Page<ServicePackageInterest> findByUserIdAndTargetTypeOrderByCreatedAtDescIdDesc(Long userId, String targetType, Pageable pageable);
}
