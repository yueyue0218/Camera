package com.action.camera.privacy.service;

import com.action.camera.admin.service.*;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.page.PageResult;
import com.action.camera.privacy.domain.PrivacyRightRequest;
import com.action.camera.privacy.dto.PrivacyDtos.*;
import com.action.camera.privacy.repository.PrivacyRightRequestRepository;
import com.action.camera.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.*;
import java.time.LocalDateTime;
import java.util.Set;

@Service
public class PrivacyRightService {
    private static final Set<String> TYPES=Set.of("ACCESS","COPY","CORRECT","DELETE");
    private static final Set<String> STATUSES=Set.of("SUBMITTED","PROCESSING","COMPLETED","REJECTED");
    private final PrivacyRightRequestRepository requests;
    private final UserRepository users;
    private final AdminPermissionService permissions;
    private final AdminAuditService audit;
    public PrivacyRightService(PrivacyRightRequestRepository requests,UserRepository users,AdminPermissionService permissions,AdminAuditService audit) {
        this.requests=requests; this.users=users; this.permissions=permissions; this.audit=audit;
    }
    @Transactional
    public RightView submit(Long userId,RightCreate input) {
        // Serializes concurrent retries across devices and backs up the database unique constraint.
        users.findByIdForUpdate(userId).filter(u -> "ACTIVE".equals(u.getStatus()))
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
        if(input==null || !TYPES.contains(input.type()) || input.description()==null || input.description().isBlank()
                || input.description().trim().length()>2000 || input.idempotencyKey()==null
                || !input.idempotencyKey().matches("[A-Za-z0-9_-]{16,64}")) throw new BusinessException(ErrorCode.VALIDATION_ERROR);
        var existing=requests.findByUserIdAndIdempotencyKey(userId,input.idempotencyKey());
        if(existing.isPresent()) {
            var r=existing.get();
            if(!r.getType().equals(input.type()) || !r.getDescription().equals(input.description().trim()))
                throw new BusinessException(ErrorCode.STATUS_CONFLICT,"同一申请标识不能重复用于不同内容");
            return view(r);
        }
        LocalDateTime now=LocalDateTime.now();
        PrivacyRightRequest r=new PrivacyRightRequest(); r.setUserId(userId); r.setType(input.type());
        r.setDescription(input.description().trim()); r.setStatus("SUBMITTED"); r.setIdempotencyKey(input.idempotencyKey());
        r.setSubmittedAt(now); r.setUpdatedAt(now); r.setResponseDueAt(now.plusDays(15));
        return view(requests.saveAndFlush(r));
    }
    @Transactional(readOnly=true)
    public PageResult<RightView> mine(Long userId,int page,int size) {
        validatePage(page,size);
        return page(requests.findByUserIdOrderBySubmittedAtDescIdDesc(userId,PageRequest.of(page-1,size)),page,size);
    }
    @Transactional(readOnly=true)
    public PageResult<RightView> adminList(String status,int page,int size) {
        permissions.requireAdmin(); validatePage(page,size);
        if(status!=null && !STATUSES.contains(status)) throw new BusinessException(ErrorCode.VALIDATION_ERROR);
        var pageable=PageRequest.of(page-1,size);
        return page(status==null ? requests.findAllByOrderBySubmittedAtDescIdDesc(pageable)
                : requests.findByStatusOrderBySubmittedAtDescIdDesc(status,pageable),page,size);
    }
    @Transactional
    public RightView resolve(Long id,RightUpdate input) {
        Long adminId=permissions.requireAdmin();
        if(input==null || !Set.of("PROCESSING","COMPLETED","REJECTED").contains(input.status())
                || input.resolutionNote()==null || input.resolutionNote().isBlank() || input.resolutionNote().trim().length()>2000)
            throw new BusinessException(ErrorCode.VALIDATION_ERROR);
        var r=requests.findByIdForUpdate(id).orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        if("COMPLETED".equals(r.getStatus()) || "REJECTED".equals(r.getStatus()))
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,"已结束的申请不能再次处理");
        if("SUBMITTED".equals(r.getStatus()) && "COMPLETED".equals(input.status()))
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,"请先受理并核验申请身份及处理边界");
        if("COMPLETED".equals(input.status())) {
            if(!Boolean.TRUE.equals(input.verifiedIdentity()) || input.verificationNote()==null
                    || input.verificationNote().isBlank() || input.verificationNote().length()>500)
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,"完成前须记录身份核验及数据处理范围，不得以申请直接作为删除授权");
            r.setVerificationNote(input.verificationNote().trim());
        }
        r.setStatus(input.status()); r.setResolutionNote(input.resolutionNote().trim()); r.setProcessedBy(adminId);
        r.setUpdatedAt(LocalDateTime.now());
        if(!"PROCESSING".equals(input.status())) r.setProcessedAt(r.getUpdatedAt());
        requests.saveAndFlush(r);
        // Full feedback stays in the request. The existing audit store has a 500 character limit.
        audit.record("PRIVACY_RIGHT",r.getId(),adminId,input.status(),r.getResolutionNote().substring(0,Math.min(500,r.getResolutionNote().length())));
        return view(r);
    }
    private void validatePage(int page,int size) {
        if(page<1 || size<1 || size>100) throw new BusinessException(ErrorCode.VALIDATION_ERROR);
    }
    private PageResult<RightView> page(Page<PrivacyRightRequest> p,int number,int size) {
        return new PageResult<>(p.getContent().stream().map(this::view).toList(),number,size,p.getTotalElements());
    }
    private RightView view(PrivacyRightRequest r) {
        return new RightView(r.getId(),r.getUserId(),r.getType(),r.getDescription(),r.getStatus(),r.getSubmittedAt(),
                r.getUpdatedAt(),r.getResolutionNote(),r.getProcessedAt(),r.getResponseDueAt());
    }
}
