package com.action.camera.admin.service;

import com.action.camera.admin.entity.AuditRecord;
import com.action.camera.admin.repository.AuditRecordRepository;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import org.springframework.stereotype.Service;

@Service
public class AdminAuditService {

    private static final int MAX_REASON_LENGTH = 500;

    private final AuditRecordRepository auditRecordRepository;

    public AdminAuditService(AuditRecordRepository auditRecordRepository) {
        this.auditRecordRepository = auditRecordRepository;
    }

    public void record(String targetType,
                       Long targetId,
                       Long adminId,
                       String action,
                       String reason) {
        String normalizedTargetType = normalizeRequired(targetType, 40, "targetType");
        String normalizedAction = normalizeRequired(action, 30, "action");
        String normalizedReason = normalizeRequired(reason, MAX_REASON_LENGTH, "reason");
        if (targetId == null || targetId <= 0 || adminId == null || adminId <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "targetId and adminId must be positive");
        }

        AuditRecord record = new AuditRecord();
        record.setAuditType(normalizedTargetType);
        record.setTargetId(targetId);
        record.setAdminId(adminId);
        record.setAuditResult(normalizedAction);
        record.setRemark(normalizedReason);
        auditRecordRepository.save(record);
    }

    private String normalizeRequired(String value, int maxLength, String field) {
        if (value == null || value.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, field + " must not be blank");
        }
        String normalized = value.trim();
        if (normalized.length() > maxLength) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, field + " is too long");
        }
        return normalized;
    }
}
