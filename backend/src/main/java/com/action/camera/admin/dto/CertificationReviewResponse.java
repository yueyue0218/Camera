package com.action.camera.admin.dto;

import java.time.LocalDateTime;

public record CertificationReviewResponse(
        Long id,
        String type,
        Long userId,
        String realNameMasked,
        String idCardNoMasked,
        String university,
        Long evidenceFrontFileId,
        Long evidenceBackFileId,
        Long studentCardFileId,
        String faceVerifyResult,
        String status,
        String rejectReason,
        LocalDateTime appliedAt,
        LocalDateTime reviewedAt,
        Long reviewerId
) {
}
