package com.action.camera.admin.repository;

import com.action.camera.admin.entity.AuditRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AuditRecordRepository extends JpaRepository<AuditRecord, Long> {

    List<AuditRecord> findTop10ByAuditTypeAndTargetIdOrderByCreatedAtDesc(
            String auditType, Long targetId);
}
