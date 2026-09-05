package com.action.camera.report.repository;

import com.action.camera.report.domain.Report;
import com.action.camera.report.domain.ReportStatus;
import com.action.camera.report.domain.ReportTargetType;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ReportRepository extends JpaRepository<Report, Long>, JpaSpecificationExecutor<Report> {

    Optional<Report> findByActiveDedupeKey(String activeDedupeKey);

    List<Report> findByReporterIdOrderByCreatedAtDesc(Long reporterId);

    long countByStatus(ReportStatus status);

    long countByTargetTypeAndTargetIdAndStatus(
            ReportTargetType targetType,
            Long targetId,
            ReportStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Report r where r.id = :id")
    Optional<Report> findByIdForUpdate(@Param("id") Long id);
}
