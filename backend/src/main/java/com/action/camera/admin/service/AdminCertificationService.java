package com.action.camera.admin.service;

import com.action.camera.admin.dto.CertificationReviewRequest;
import com.action.camera.admin.dto.CertificationReviewResponse;
import com.action.camera.admin.entity.AuditRecord;
import com.action.camera.admin.entity.RealNameCertification;
import com.action.camera.admin.entity.StudentCertification;
import com.action.camera.admin.repository.AuditRecordRepository;
import com.action.camera.admin.repository.RealNameCertificationRepository;
import com.action.camera.admin.repository.StudentCertificationRepository;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.notification.dto.NotificationCreateRequest;
import com.action.camera.notification.service.NotificationService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class AdminCertificationService {

    private static final String TYPE_REAL_NAME = "REAL_NAME";
    private static final String TYPE_STUDENT = "STUDENT";
    private static final String PENDING_REVIEW = "PENDING_REVIEW";
    private static final String APPROVED = "APPROVED";
    private static final String REJECTED = "REJECTED";

    private final AdminPermissionService permissionService;
    private final RealNameCertificationRepository realNameCertificationRepository;
    private final StudentCertificationRepository studentCertificationRepository;
    private final AuditRecordRepository auditRecordRepository;
    private final NotificationService notificationService;

    public AdminCertificationService(AdminPermissionService permissionService,
                                     RealNameCertificationRepository realNameCertificationRepository,
                                     StudentCertificationRepository studentCertificationRepository,
                                     AuditRecordRepository auditRecordRepository,
                                     NotificationService notificationService) {
        this.permissionService = permissionService;
        this.realNameCertificationRepository = realNameCertificationRepository;
        this.studentCertificationRepository = studentCertificationRepository;
        this.auditRecordRepository = auditRecordRepository;
        this.notificationService = notificationService;
    }

    @Transactional(readOnly = true)
    public List<CertificationReviewResponse> list(String type, String status) {
        permissionService.requireAdmin();
        String normalizedType = normalizeType(type);
        String normalizedStatus = isBlank(status) ? PENDING_REVIEW : status.trim();
        if (TYPE_REAL_NAME.equals(normalizedType)) {
            return realNameCertificationRepository.findByStatusOrderByAppliedAtAsc(normalizedStatus).stream()
                    .map(this::toResponse)
                    .toList();
        }
        return studentCertificationRepository.findByStatusOrderByAppliedAtAsc(normalizedStatus).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public CertificationReviewResponse review(String type, Long certificationId, CertificationReviewRequest request) {
        Long adminId = permissionService.requireAdmin();
        String normalizedType = normalizeType(type);
        String result = validateResult(request);
        if (TYPE_REAL_NAME.equals(normalizedType)) {
            RealNameCertification certification = realNameCertificationRepository.findById(certificationId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Certification not found"));
            ensurePending(certification.getStatus());
            applyReview(certification, adminId, result, request);
            saveAudit("REAL_NAME_CERTIFICATION", certification.getId(), adminId, result, request);
            notifyCertificationReviewed(certification.getUserId(), "REAL_NAME_CERTIFICATION", certification.getId(), result);
            return toResponse(certification);
        }

        StudentCertification certification = studentCertificationRepository.findById(certificationId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Certification not found"));
        ensurePending(certification.getStatus());
        applyReview(certification, adminId, result, request);
        saveAudit("STUDENT_CERTIFICATION", certification.getId(), adminId, result, request);
        notifyCertificationReviewed(certification.getUserId(), "STUDENT_CERTIFICATION", certification.getId(), result);
        return toResponse(certification);
    }

    private String validateResult(CertificationReviewRequest request) {
        if (request == null || isBlank(request.result())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Review result is required");
        }
        String result = request.result().trim();
        if (!APPROVED.equals(result) && !REJECTED.equals(result)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unsupported review result");
        }
        if (REJECTED.equals(result) && isBlank(request.reason())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Reject reason is required");
        }
        if (request.reason() != null && request.reason().trim().length() > 255) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Reject reason is too long");
        }
        return result;
    }

    private void ensurePending(String status) {
        if (!PENDING_REVIEW.equals(status)) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "Certification has been reviewed");
        }
    }

    private void applyReview(RealNameCertification certification,
                             Long adminId,
                             String result,
                             CertificationReviewRequest request) {
        certification.setStatus(result);
        certification.setRejectReason(REJECTED.equals(result) ? request.reason().trim() : null);
        certification.setReviewedAt(LocalDateTime.now());
        certification.setReviewerId(adminId);
    }

    private void applyReview(StudentCertification certification,
                             Long adminId,
                             String result,
                             CertificationReviewRequest request) {
        certification.setStatus(result);
        certification.setRejectReason(REJECTED.equals(result) ? request.reason().trim() : null);
        certification.setReviewedAt(LocalDateTime.now());
        certification.setReviewerId(adminId);
    }

    private void saveAudit(String auditType,
                           Long targetId,
                           Long adminId,
                           String result,
                           CertificationReviewRequest request) {
        AuditRecord auditRecord = new AuditRecord();
        auditRecord.setAuditType(auditType);
        auditRecord.setTargetId(targetId);
        auditRecord.setAdminId(adminId);
        auditRecord.setAuditResult(result);
        auditRecord.setRemark(trimToNull(request.remark()));
        auditRecordRepository.save(auditRecord);
    }

    private String normalizeType(String type) {
        if (isBlank(type)) {
            return TYPE_REAL_NAME;
        }
        String normalized = type.trim().toUpperCase();
        if (!TYPE_REAL_NAME.equals(normalized) && !TYPE_STUDENT.equals(normalized)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unsupported certification type");
        }
        return normalized;
    }

    private CertificationReviewResponse toResponse(RealNameCertification certification) {
        return new CertificationReviewResponse(
                certification.getId(),
                TYPE_REAL_NAME,
                certification.getUserId(),
                certification.getRealNameMasked(),
                certification.getIdCardNoMasked(),
                null,
                certification.getIdCardFrontFileId(),
                certification.getIdCardBackFileId(),
                null,
                certification.getFaceVerifyResult(),
                certification.getStatus(),
                certification.getRejectReason(),
                certification.getAppliedAt(),
                certification.getReviewedAt(),
                certification.getReviewerId()
        );
    }

    private CertificationReviewResponse toResponse(StudentCertification certification) {
        return new CertificationReviewResponse(
                certification.getId(),
                TYPE_STUDENT,
                certification.getUserId(),
                certification.getRealNameMasked(),
                null,
                certification.getUniversity(),
                null,
                null,
                certification.getStudentCardFileId(),
                null,
                certification.getStatus(),
                certification.getRejectReason(),
                certification.getAppliedAt(),
                certification.getReviewedAt(),
                certification.getReviewerId()
        );
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String trimToNull(String value) {
        if (isBlank(value)) {
            return null;
        }
        return value.trim();
    }

    private void notifyCertificationReviewed(Long userId, String certificationType, Long certificationId, String result) {
        notificationService.createNotification(new NotificationCreateRequest(
                userId,
                "Certification reviewed",
                "Your certification review result is " + result + ".",
                "CERTIFICATION_REVIEWED",
                certificationType,
                certificationId
        ));
    }
}
