package com.action.camera.admin.repository;

import com.action.camera.admin.entity.AuditRecord;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditRecordRepository extends JpaRepository<AuditRecord, Long> {
}
