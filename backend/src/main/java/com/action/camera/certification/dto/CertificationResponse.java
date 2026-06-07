package com.action.camera.certification.dto;

import com.action.camera.certification.entity.RealNameCertification;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class CertificationResponse {

    private Long id;
    private Long userId;
    private String realName;
    private String idCardNumber;
    private Long idCardFrontFileId;
    private Long idCardBackFileId;
    private String status;
    private String rejectReason;
    private LocalDateTime createdAt;
    private LocalDateTime reviewedAt;
    private Long reviewerAdminId;

    public static CertificationResponse from(RealNameCertification cert) {
        CertificationResponse resp = new CertificationResponse();
        resp.setId(cert.getId());
        resp.setUserId(cert.getUserId());
        resp.setRealName(cert.getRealName());
        resp.setIdCardNumber(cert.getIdCardNumber());
        resp.setIdCardFrontFileId(cert.getIdCardFrontFileId());
        resp.setIdCardBackFileId(cert.getIdCardBackFileId());
        resp.setStatus(cert.getStatus());
        resp.setRejectReason(cert.getRejectReason());
        resp.setCreatedAt(cert.getCreatedAt());
        resp.setReviewedAt(cert.getReviewedAt());
        resp.setReviewerAdminId(cert.getReviewerAdminId());
        return resp;
    }
}
