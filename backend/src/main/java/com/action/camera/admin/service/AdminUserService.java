package com.action.camera.admin.service;

import com.action.camera.admin.dto.AdminUserDetailResponse;
import com.action.camera.admin.dto.AdminUserDetailResponse.AuditRecordResponse;
import com.action.camera.admin.dto.AdminUserListItemResponse;
import com.action.camera.admin.entity.AuditRecord;
import com.action.camera.admin.repository.AdminUserQueryRepository;
import com.action.camera.admin.repository.AdminUserQueryRepository.DetailSummary;
import com.action.camera.admin.repository.AdminUserQueryRepository.UserPage;
import com.action.camera.admin.repository.AuditRecordRepository;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.page.PageResult;
import com.action.camera.domain.User;
import com.action.camera.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class AdminUserService {

    private static final String ACTIVE = "ACTIVE";
    private static final String DISABLED = "DISABLED";
    private static final String ADMIN = "ADMIN";
    private static final Set<String> FILTER_ROLES = Set.of("CUSTOMER", "PROVIDER", ADMIN);
    private static final Set<String> FILTER_STATUSES = Set.of(ACTIVE, DISABLED);

    private final AdminPermissionService adminPermissionService;
    private final AdminUserQueryRepository adminUserQueryRepository;
    private final UserRepository userRepository;
    private final AuditRecordRepository auditRecordRepository;
    private final AdminAuditService adminAuditService;

    public AdminUserService(AdminPermissionService adminPermissionService,
                            AdminUserQueryRepository adminUserQueryRepository,
                            UserRepository userRepository,
                            AuditRecordRepository auditRecordRepository,
                            AdminAuditService adminAuditService) {
        this.adminPermissionService = adminPermissionService;
        this.adminUserQueryRepository = adminUserQueryRepository;
        this.userRepository = userRepository;
        this.auditRecordRepository = auditRecordRepository;
        this.adminAuditService = adminAuditService;
    }

    @Transactional(readOnly = true)
    public PageResult<AdminUserListItemResponse> list(String keyword,
                                                       String role,
                                                       String status,
                                                       int page,
                                                       int size) {
        adminPermissionService.requireAdmin();
        validatePage(page, size);
        String normalizedKeyword = normalizeKeyword(keyword);
        String normalizedRole = normalizeFilter(role, FILTER_ROLES, "role");
        String normalizedStatus = normalizeFilter(status, FILTER_STATUSES, "status");
        Long keywordUserId = parsePositiveLong(normalizedKeyword);
        UserPage result = adminUserQueryRepository.findPage(
                normalizedKeyword, keywordUserId, normalizedRole, normalizedStatus,
                size, (page - 1) * size);
        return new PageResult<>(result.records(), page, size, result.total());
    }

    @Transactional(readOnly = true)
    public AdminUserDetailResponse detail(Long userId) {
        adminPermissionService.requireAdmin();
        return detailForExistingUser(findUser(userId));
    }

    @Transactional
    public AdminUserDetailResponse changeStatus(Long userId, String status, String reason) {
        Long adminId = adminPermissionService.requireAdmin();
        String normalizedStatus = normalizeRequiredStatus(status);
        String normalizedReason = normalizeReason(reason);
        User target = findUserForUpdate(userId);
        if (normalizedStatus.equals(target.getStatus())) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "User already has the requested status");
        }
        if (DISABLED.equals(normalizedStatus)) {
            ensureCanDisable(target, adminId);
        }

        target.setStatus(normalizedStatus);
        userRepository.save(target);
        adminAuditService.record(
                "USER", target.getId(), adminId,
                DISABLED.equals(normalizedStatus) ? "DISABLE" : "ENABLE",
                normalizedReason);
        return detailForExistingUser(target);
    }

    private void ensureCanDisable(User target, Long adminId) {
        if (target.getId().equals(adminId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Administrators cannot disable themselves");
        }
        if (!adminPermissionService.hasAdminPermission(target.getId())) {
            return;
        }
        List<User> activeAdministrators = userRepository.findActiveAdministratorsForUpdate();
        boolean anotherActiveAdministrator = activeAdministrators.stream()
                .anyMatch(user -> !user.getId().equals(target.getId()));
        if (!anotherActiveAdministrator) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                    "The last active administrator cannot be disabled");
        }
    }

    private AdminUserDetailResponse detailForExistingUser(User user) {
        DetailSummary summary = adminUserQueryRepository.detailSummary(user.getId());
        List<AuditRecordResponse> audits = auditRecordRepository
                .findTop10ByAuditTypeAndTargetIdOrderByCreatedAtDesc("USER", user.getId())
                .stream()
                .map(this::toAuditResponse)
                .toList();
        return new AdminUserDetailResponse(
                user.getId(),
                user.getNickname(),
                user.getAvatarFileId(),
                user.getCurrentRole(),
                adminPermissionService.hasAdminPermission(user.getId()),
                user.getStatus(),
                user.getSchool(),
                user.getCityCode(),
                user.getBio(),
                user.getCreatedAt(),
                summary.studentCertificationStatus(),
                summary.realNameCertificationStatus(),
                summary.publicDemandCount(),
                summary.publicServicePackageCount(),
                summary.publicMomentCount(),
                summary.totalReportCount(),
                summary.pendingReportCount(),
                audits);
    }

    private AuditRecordResponse toAuditResponse(AuditRecord record) {
        return new AuditRecordResponse(
                record.getId(),
                record.getAuditType(),
                record.getTargetId(),
                record.getAdminId(),
                record.getAuditResult(),
                record.getRemark(),
                record.getCreatedAt());
    }

    private User findUser(Long userId) {
        if (userId == null || userId <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "userId must be positive");
        }
        return userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "User not found"));
    }

    private User findUserForUpdate(Long userId) {
        if (userId == null || userId <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "userId must be positive");
        }
        return userRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "User not found"));
    }

    private void validatePage(int page, int size) {
        if (page < 1 || size < 1 || size > 100) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "page must be at least 1 and size must be between 1 and 100");
        }
    }

    private String normalizeKeyword(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return null;
        }
        String normalized = keyword.trim();
        if (normalized.length() > 100) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "keyword is too long");
        }
        return normalized;
    }

    private String normalizeFilter(String value, Set<String> supported, String field) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        if (!supported.contains(normalized)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unsupported " + field);
        }
        return normalized;
    }

    private String normalizeRequiredStatus(String status) {
        if (status == null || status.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "status must not be blank");
        }
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        if (!FILTER_STATUSES.contains(normalized)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unsupported status");
        }
        return normalized;
    }

    private String normalizeReason(String reason) {
        if (reason == null || reason.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "reason must not be blank");
        }
        String normalized = reason.trim();
        if (normalized.length() > 500) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "reason is too long");
        }
        return normalized;
    }

    private Long parsePositiveLong(String value) {
        if (value == null || !value.chars().allMatch(Character::isDigit)) {
            return null;
        }
        try {
            long parsed = Long.parseLong(value);
            return parsed > 0 ? parsed : null;
        } catch (NumberFormatException ignored) {
            return null;
        }
    }
}
