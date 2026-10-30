package com.action.camera.account.service;

import com.action.camera.account.domain.AccountCancellationRequest;
import com.action.camera.account.domain.AccountCancellationStatus;
import com.action.camera.account.dto.AdminAccountCancellationResponse;
import com.action.camera.account.dto.AdminAccountCancellationUpdateRequest;
import com.action.camera.account.repository.AccountCancellationCleanupRepository;
import com.action.camera.account.repository.AccountCancellationRequestRepository;
import com.action.camera.admin.service.AdminAuditService;
import com.action.camera.admin.service.AdminPermissionService;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.page.PageResult;
import com.action.camera.domain.User;
import com.action.camera.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Locale;

@Service
public class AdminAccountCancellationService {

    private final AdminPermissionService adminPermissionService;
    private final AdminAuditService adminAuditService;
    private final AccountCancellationRequestRepository requestRepository;
    private final AccountCancellationCleanupRepository cleanupRepository;
    private final UserRepository userRepository;

    public AdminAccountCancellationService(AdminPermissionService adminPermissionService,
                                           AdminAuditService adminAuditService,
                                           AccountCancellationRequestRepository requestRepository,
                                           AccountCancellationCleanupRepository cleanupRepository,
                                           UserRepository userRepository) {
        this.adminPermissionService = adminPermissionService;
        this.adminAuditService = adminAuditService;
        this.requestRepository = requestRepository;
        this.cleanupRepository = cleanupRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public PageResult<AdminAccountCancellationResponse> list(String status, int page, int size) {
        adminPermissionService.requireAdmin();
        validatePage(page, size);
        AccountCancellationStatus normalizedStatus = parseOptionalStatus(status);
        PageRequest pageable = PageRequest.of(page - 1, size);
        Page<AccountCancellationRequest> result = normalizedStatus == null
                ? requestRepository.findAllByOrderByRequestedAtDesc(pageable)
                : requestRepository.findAllByStatusOrderByRequestedAtDesc(normalizedStatus, pageable);
        return new PageResult<>(result.getContent().stream().map(this::toResponse).toList(),
                page, size, result.getTotalElements());
    }

    @Transactional
    public AdminAccountCancellationResponse update(Long requestId,
                                                    AdminAccountCancellationUpdateRequest input) {
        Long adminId = adminPermissionService.requireAdmin();
        if (input == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "处理信息不能为空");
        }
        AccountCancellationStatus targetStatus = parseTargetStatus(input.status());
        String note = normalizeNote(input.resolutionNote());
        AccountCancellationRequest request = findRequestForUpdate(requestId);
        validateTransition(request.getStatus(), targetStatus);

        LocalDateTime now = LocalDateTime.now();
        if (targetStatus == AccountCancellationStatus.COMPLETED) {
            completeCancellation(request, adminId, now);
            request.setProcessedAt(now);
        } else if (targetStatus == AccountCancellationStatus.REJECTED) {
            request.setProcessedAt(now);
        } else {
            request.setProcessedAt(null);
        }
        request.setStatus(targetStatus);
        request.setResolutionNote(note);
        requestRepository.save(request);
        adminAuditService.record("ACCOUNT_CANCELLATION", request.getId(), adminId,
                targetStatus.name(), note);
        return toResponse(request);
    }

    private void completeCancellation(AccountCancellationRequest request, Long adminId, LocalDateTime now) {
        Long userId = request.getUserId();
        if (userId.equals(adminId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "管理员不能注销当前登录账号");
        }
        if (adminPermissionService.hasAdminPermission(userId)) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "管理员账号必须先移除管理权限");
        }
        User user = userRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "用户不存在"));
        if ("DELETED".equals(user.getStatus())) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "账号已经注销");
        }
        cleanupRepository.lockParticipantQuotes(userId);
        long blockingOrders = cleanupRepository.countBlockingOrders(userId);
        long openDisputes = cleanupRepository.countOpenDisputes(userId);
        if (blockingOrders > 0 || openDisputes > 0) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                    "仍有进行中订单或未解决争议，暂不能完成注销");
        }

        cleanupRepository.cleanupUserData(userId, user.getMobileHash(), now);
        anonymize(user);
        userRepository.save(user);
    }

    static void anonymize(User user) {
        user.setStudentNo(null);
        user.setPasswordHash(null);
        user.setMobileCipher(null);
        user.setMobileHash(null);
        user.setMobileMasked(null);
        user.setPhoneVerifiedAt(null);
        user.setLastLoginAt(null);
        user.setNickname("已注销用户-" + user.getId());
        user.setSchool(null);
        user.setAvatarFileId(null);
        user.setGender(null);
        user.setGenderVisible(false);
        user.setBirthday(null);
        user.setBirthdayVisible(false);
        user.setLocationDisplay(null);
        user.setLocationVisible(false);
        user.setCityCode(null);
        user.setBio(null);
        user.setCurrentRole("CUSTOMER");
        user.setStatus("DELETED");
    }

    private AccountCancellationRequest findRequestForUpdate(Long requestId) {
        if (requestId == null || requestId <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "requestId必须为正数");
        }
        return requestRepository.findByIdForUpdate(requestId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "注销申请不存在"));
    }

    private void validateTransition(AccountCancellationStatus current,
                                    AccountCancellationStatus target) {
        if (current == target) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "申请已经处于目标状态");
        }
        boolean allowed = (current == AccountCancellationStatus.PENDING
                && (target == AccountCancellationStatus.PROCESSING
                || target == AccountCancellationStatus.REJECTED
                || target == AccountCancellationStatus.COMPLETED))
                || (current == AccountCancellationStatus.PROCESSING
                && (target == AccountCancellationStatus.REJECTED
                || target == AccountCancellationStatus.COMPLETED));
        if (!allowed) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "当前状态不允许该处理操作");
        }
    }

    private AccountCancellationStatus parseOptionalStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return AccountCancellationStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "不支持的注销申请状态");
        }
    }

    private AccountCancellationStatus parseTargetStatus(String status) {
        AccountCancellationStatus parsed = parseOptionalStatus(status);
        if (parsed == null || parsed == AccountCancellationStatus.PENDING) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "处理状态仅支持PROCESSING、REJECTED或COMPLETED");
        }
        return parsed;
    }

    private String normalizeNote(String note) {
        if (note == null || note.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "处理说明不能为空");
        }
        String normalized = note.trim();
        if (normalized.length() > 500) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "处理说明不能超过500个字符");
        }
        return normalized;
    }

    private void validatePage(int page, int size) {
        if (page < 1 || size < 1 || size > 100) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "page必须至少为1，size必须在1到100之间");
        }
    }

    private AdminAccountCancellationResponse toResponse(AccountCancellationRequest request) {
        return new AdminAccountCancellationResponse(
                request.getId(), request.getUserId(), request.getStatus().name(), request.getReason(),
                request.getRequestedAt(), request.getUpdatedAt(), request.getProcessedAt(),
                request.getResolutionNote());
    }
}
