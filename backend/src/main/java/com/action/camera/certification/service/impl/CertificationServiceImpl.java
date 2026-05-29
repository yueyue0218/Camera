package com.action.camera.certification.service.impl;

import com.action.camera.certification.dto.CertificationRequest;
import com.action.camera.certification.dto.CertificationResponse;
import com.action.camera.certification.entity.AuditRecord;
import com.action.camera.certification.entity.RealNameCertification;
import com.action.camera.certification.event.CertificationApprovedEvent;
import com.action.camera.certification.mapper.AuditRecordMapper;
import com.action.camera.certification.mapper.RealNameCertificationMapper;
import com.action.camera.certification.service.CertificationService;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.page.PageResult;
import com.action.camera.domain.User;
import com.action.camera.repository.UserRepository;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class CertificationServiceImpl implements CertificationService {

    private final RealNameCertificationMapper certificationMapper;
    private final AuditRecordMapper auditRecordMapper;
    private final UserRepository userRepository;
    private final ApplicationEventPublisher eventPublisher;

    public CertificationServiceImpl(RealNameCertificationMapper certificationMapper,
                                    AuditRecordMapper auditRecordMapper,
                                    UserRepository userRepository,
                                    ApplicationEventPublisher eventPublisher) {
        this.certificationMapper = certificationMapper;
        this.auditRecordMapper = auditRecordMapper;
        this.userRepository = userRepository;
        this.eventPublisher = eventPublisher;
    }

    @Override
    @Transactional
    public CertificationResponse submit(Long userId, CertificationRequest request) {
        RealNameCertification existing = certificationMapper.selectOne(
                new LambdaQueryWrapper<RealNameCertification>()
                        .eq(RealNameCertification::getUserId, userId)
                        .in(RealNameCertification::getStatus, "PENDING", "APPROVED")
                        .orderByDesc(RealNameCertification::getCreatedAt)
                        .last("LIMIT 1")
        );

        if (existing != null) {
            if ("PENDING".equals(existing.getStatus())) {
                throw new BusinessException(ErrorCode.CERT_PENDING);
            }
            throw new BusinessException(ErrorCode.CERT_APPROVED);
        }

        RealNameCertification cert = new RealNameCertification();
        cert.setUserId(userId);
        cert.setRealName(request.getRealName());
        cert.setIdCardNumber(maskIdCard(request.getIdCardNumber()));
        cert.setIdCardFrontFileId(request.getIdCardFrontFileId());
        cert.setIdCardBackFileId(request.getIdCardBackFileId());
        cert.setStatus("PENDING");
        certificationMapper.insert(cert);

        return CertificationResponse.from(cert);
    }

    @Override
    public CertificationResponse getMyLatest(Long userId) {
        RealNameCertification cert = certificationMapper.selectOne(
                new LambdaQueryWrapper<RealNameCertification>()
                        .eq(RealNameCertification::getUserId, userId)
                        .orderByDesc(RealNameCertification::getCreatedAt)
                        .last("LIMIT 1")
        );
        if (cert == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "未找到认证记录");
        }
        return CertificationResponse.from(cert);
    }

    @Override
    @Transactional
    public void approve(Long adminId, Long certId) {
        checkAdminRole(adminId);

        RealNameCertification cert = requirePendingCert(certId);
        cert.setStatus("APPROVED");
        cert.setReviewedAt(LocalDateTime.now());
        cert.setReviewerAdminId(adminId);
        certificationMapper.updateById(cert);

        saveAuditRecord(certId, adminId, "APPROVE", null);

        eventPublisher.publishEvent(new CertificationApprovedEvent(this, cert));
    }

    @Override
    @Transactional
    public void reject(Long adminId, Long certId, String rejectReason) {
        checkAdminRole(adminId);

        RealNameCertification cert = requirePendingCert(certId);
        cert.setStatus("REJECTED");
        cert.setRejectReason(rejectReason);
        cert.setReviewedAt(LocalDateTime.now());
        cert.setReviewerAdminId(adminId);
        certificationMapper.updateById(cert);

        saveAuditRecord(certId, adminId, "REJECT", rejectReason);
    }

    @Override
    public PageResult<CertificationResponse> listByStatus(Long adminId, String status, int page, int size) {
        checkAdminRole(adminId);

        // 先 count，再查数据（MyBatis-Plus 3.5.9 去掉了 PaginationInnerInterceptor，total 需手动计算）
        LambdaQueryWrapper<RealNameCertification> countWrapper = new LambdaQueryWrapper<RealNameCertification>();
        if (status != null && !status.isBlank()) {
            countWrapper.eq(RealNameCertification::getStatus, status);
        }
        long total = certificationMapper.selectCount(countWrapper);

        // API 用 0-indexed page，MyBatis-Plus 用 1-indexed
        Page<RealNameCertification> pageParam = new Page<>(page + 1L, size);
        var result = certificationMapper.selectPageByStatus(pageParam, status);

        List<CertificationResponse> records = result.getRecords().stream()
                .map(CertificationResponse::from)
                .toList();

        return new PageResult<>(records, page, size, total);
    }

    // ---- 私有工具方法 ----

    /** 前3位 + 若干 * + 后4位 */
    private String maskIdCard(String idCard) {
        if (idCard == null || idCard.length() <= 7) {
            return idCard;
        }
        return idCard.substring(0, 3)
                + "*".repeat(idCard.length() - 7)
                + idCard.substring(idCard.length() - 4);
    }

    private void checkAdminRole(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
        if (!"ADMIN".equals(user.getCurrentRole())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "需要管理员权限");
        }
    }

    private RealNameCertification requirePendingCert(Long certId) {
        RealNameCertification cert = certificationMapper.selectById(certId);
        if (cert == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "认证申请不存在");
        }
        if (!"PENDING".equals(cert.getStatus())) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "该申请当前状态不可审批");
        }
        return cert;
    }

    private void saveAuditRecord(Long certId, Long adminId, String action, String reason) {
        AuditRecord record = new AuditRecord();
        record.setTargetType("REAL_NAME_CERT");
        record.setTargetId(certId);
        record.setAdminId(adminId);
        record.setAction(action);
        record.setReason(reason);
        auditRecordMapper.insert(record);
    }
}
