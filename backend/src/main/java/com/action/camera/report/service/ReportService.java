package com.action.camera.report.service;

import com.action.camera.admin.dto.AdminHallItemType;
import com.action.camera.admin.service.AdminAuditService;
import com.action.camera.admin.service.AdminPermissionService;
import com.action.camera.admin.service.AdminUserService;
import com.action.camera.admin.service.ContentModerationService;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.page.PageResult;
import com.action.camera.report.domain.Report;
import com.action.camera.report.domain.ReportResolution;
import com.action.camera.report.domain.ReportStatus;
import com.action.camera.report.domain.ReportTargetType;
import com.action.camera.report.dto.ReportCreateRequest;
import com.action.camera.report.dto.ReportResolveRequest;
import com.action.camera.report.dto.ReportResponse;
import com.action.camera.report.repository.ReportRepository;
import com.action.camera.review.service.ReviewModerationService;
import com.action.camera.notification.dto.NotificationCreateRequest;
import com.action.camera.notification.service.NotificationService;
import java.util.UUID;
import jakarta.persistence.criteria.Predicate;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class ReportService {
    private final ReportRepository reportRepository;
    private final ReportTargetValidator targetValidator;
    private final AdminPermissionService adminPermissionService;
    private final ContentModerationService contentModerationService;
    private final AdminUserService adminUserService;
    private final ReviewModerationService reviewModerationService;
    private final AdminAuditService adminAuditService;
    private final NotificationService notificationService;

    public ReportService(ReportRepository reportRepository,
                         ReportTargetValidator targetValidator,
                         AdminPermissionService adminPermissionService,
                         ContentModerationService contentModerationService,
                         AdminUserService adminUserService,
                         ReviewModerationService reviewModerationService,
                         AdminAuditService adminAuditService, NotificationService notificationService) {
        this.reportRepository = reportRepository;
        this.targetValidator = targetValidator;
        this.adminPermissionService = adminPermissionService;
        this.contentModerationService = contentModerationService;
        this.adminUserService = adminUserService;
        this.reviewModerationService = reviewModerationService;
        this.adminAuditService = adminAuditService;
        this.notificationService = notificationService;
    }

    @Transactional
    public ReportResponse create(ReportCreateRequest request) {
        Long reporterId = requireCurrentUser();
        if (request == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "request must not be null");
        }
        ReportTargetType targetType = parseTargetType(request.targetType());
        String reason = normalizeRequired(request.reason(), 500, "reason");
        String description = normalizeOptional(request.description(), 1000, "description");
        targetValidator.validateReportable(targetType, request.targetId(), reporterId);

        String dedupeKey = reporterId + ":" + targetType.name() + ":" + request.targetId();
        if (reportRepository.findByActiveDedupeKey(dedupeKey).isPresent()) {
            throw new BusinessException(ErrorCode.DUPLICATE_OPERATION, "Pending report already exists");
        }
        try {
            Report saved = reportRepository.save(Report.create(
                    reporterId, targetType, request.targetId(), reason, description, LocalDateTime.now()));
            reportRepository.flush();
            return toPublicResponse(saved);
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(ErrorCode.DUPLICATE_OPERATION, "Pending report already exists");
        }
    }

    @Transactional(readOnly = true)
    public List<ReportResponse> listMine() {
        Long reporterId = requireCurrentUser();
        return reportRepository.findByReporterIdOrderByCreatedAtDesc(reporterId).stream()
                .map(this::toPublicResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PageResult<ReportResponse> listForAdmin(String targetType,
                                                   String status,
                                                   String keyword,
                                                   int page,
                                                   int size) {
        adminPermissionService.requireAdmin();
        validatePage(page, size);
        ReportTargetType normalizedTargetType = parseOptionalTargetType(targetType);
        ReportStatus normalizedStatus = parseOptionalStatus(status);
        String normalizedKeyword = normalizeOptional(keyword, 100, "keyword");
        Long keywordId = parsePositiveLong(normalizedKeyword);

        Specification<Report> specification = (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (normalizedTargetType != null) {
                predicates.add(builder.equal(root.get("targetType"), normalizedTargetType));
            }
            if (normalizedStatus != null) {
                predicates.add(builder.equal(root.get("status"), normalizedStatus));
            }
            if (normalizedKeyword != null) {
                Predicate reasonMatch = builder.like(
                        builder.lower(root.get("reason")), "%" + normalizedKeyword.toLowerCase(Locale.ROOT) + "%");
                if (keywordId == null) {
                    predicates.add(reasonMatch);
                } else {
                    predicates.add(builder.or(
                            builder.equal(root.get("id"), keywordId),
                            builder.equal(root.get("targetId"), keywordId),
                            builder.equal(root.get("reporterId"), keywordId),
                            reasonMatch));
                }
            }
            return builder.and(predicates.toArray(Predicate[]::new));
        };
        org.springframework.data.domain.Page<Report> result = reportRepository.findAll(
                specification,
                PageRequest.of(page - 1, size, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))));
        return new PageResult<>(result.getContent().stream().map(this::toResponse).toList(),
                page, size, result.getTotalElements());
    }

    @Transactional(readOnly = true)
    public ReportResponse adminDetail(Long reportId) {
        adminPermissionService.requireAdmin();
        return toResponse(findReport(reportId));
    }

    @Transactional
    public ReportResponse resolve(Long reportId, ReportResolveRequest request) {
        Long adminId = adminPermissionService.requireAdmin();
        if (request == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "request must not be null");
        }
        ReportResolution resolution = parseResolution(request.resolution());
        String comment = normalizeRequired(request.adminComment(), 1000, "adminComment");
        Report report = findReportForUpdate(reportId);
        if (!ReportStatus.PENDING.equals(report.getStatus())) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "Report has already been resolved");
        }
        validateCompatibility(report.getTargetType(), resolution);
        Long ownerId = resolution == ReportResolution.IGNORE || resolution == ReportResolution.RESTORE ? null
                : targetValidator.targetOwnerId(report.getTargetType(), report.getTargetId());
        if (resolution != ReportResolution.IGNORE && resolution != ReportResolution.RESTORE && (ownerId == null || ownerId <= 0)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Target owner not found");
        }
        mutateTarget(report, resolution, adminId, resolution == ReportResolution.RESTORE ? publicMessage(resolution) :
                resolution == ReportResolution.IGNORE ? publicMessage(resolution) : targetMessage(resolution));
        report.resolve(adminId, resolution, comment, LocalDateTime.now());
        report.recordPublicFeedback(publicMessage(resolution), resolution == ReportResolution.IGNORE);
        Report saved = reportRepository.save(report);
        adminAuditService.record(
                "REPORT", report.getId(), adminId, "RESOLVE",
                truncateAuditReason(resolution.name() + ": " + comment));
        publishResult(saved, resolution, ownerId);
        return toResponse(saved);
    }
    private String publicMessage(ReportResolution resolution) {
        return switch (resolution) {
            case IGNORE -> "感谢你的反馈，你的举报我们已收到并记录，后续会重点关注相关情况。";
            case TAKE_DOWN -> "平台已完成核查，相关内容已下架，感谢你对社区秩序的维护。";
            case REVIEW_HIDDEN -> "平台已完成核查，相关评价已隐藏，感谢你的反馈。";
            case RESTRICT_USER -> "平台已完成核查，相关账号已按规则限制使用，感谢你的反馈。";
            case RESTORE -> "平台已完成复核，相关内容已恢复展示。";
        };
    }
    private String targetMessage(ReportResolution resolution) {
        return switch (resolution) {
            case TAKE_DOWN -> "平台已完成审核，你发布的相关内容已被下架。";
            case REVIEW_HIDDEN -> "平台已完成审核，你发布的相关评价已被隐藏。";
            case RESTRICT_USER -> "平台已完成审核，你的账号已按规则限制使用。";
            default -> throw new BusinessException(ErrorCode.VALIDATION_ERROR);
        };
    }
    private String outcome(Report report) {
        if (report.getStatus() == ReportStatus.PENDING) { return "PENDING"; }
        if (report.getPublicMessage() == null || report.getResolution() == ReportResolution.RESTORE) { return "LEGACY"; }
        return report.isFollowUpRequired() ? "FOLLOW_UP" : "ACTION_TAKEN";
    }
    private void publishResult(Report report, ReportResolution resolution, Long ownerId) {
        notificationService.createNotification(new NotificationCreateRequest(
                report.getReporterId(), null, "举报处理反馈", report.getPublicMessage(),
                "REPORT_RESOLVED", "REPORT_RESOLVED", "REPORT", report.getId(), "REPORT", report.getId(),
                "REPORT", report.getId(), "report:resolved:" + report.getId(),
                "{\"reportId\":" + report.getId() + ",\"publicOutcome\":\"" + outcome(report) + "\"}"));
        if (ownerId == null) { return; }
        String type = report.getTargetType().name();
        notificationService.createNotification(new NotificationCreateRequest(
                ownerId, null, "平台处理通知", targetMessage(resolution), "MODERATION_RESULT", "MODERATION_RESULT",
                type, report.getTargetId(), type, report.getTargetId(), type, report.getTargetId(),
                "moderation:" + UUID.randomUUID(),
                "{\"action\":\"" + resolution.name() + "\",\"targetType\":\"" + type +
                        "\",\"targetId\":" + report.getTargetId() + "}"));
    }

    private void mutateTarget(Report report, ReportResolution resolution, Long adminId, String reason) {
        if (resolution == ReportResolution.IGNORE) {
            return;
        }
        switch (report.getTargetType()) {
            case DEMAND -> mutateHall(AdminHallItemType.DEMAND, report.getTargetId(), resolution, reason);
            case SERVICE_PACKAGE -> mutateHall(AdminHallItemType.SERVICE_PACKAGE, report.getTargetId(), resolution, reason);
            case MOMENT -> {
                if (resolution == ReportResolution.TAKE_DOWN) {
                    contentModerationService.takeDownMoment(report.getTargetId(), reason);
                } else {
                    contentModerationService.restoreMoment(report.getTargetId(), reason);
                }
            }
            case USER -> adminUserService.changeStatus(report.getTargetId(), "DISABLED", reason);
            case REVIEW -> reviewModerationService.hideForGovernance(
                    report.getTargetId(), adminId, "MODERATION_REVIEW", report.getTargetId(), reason);
        }
    }

    private void mutateHall(AdminHallItemType type, Long targetId, ReportResolution resolution, String reason) {
        if (resolution == ReportResolution.TAKE_DOWN) {
            contentModerationService.takeDownHallItem(type, targetId, reason);
        } else {
            contentModerationService.restoreHallItem(type, targetId, reason);
        }
    }

    private void validateCompatibility(ReportTargetType targetType, ReportResolution resolution) {
        boolean compatible = resolution == ReportResolution.IGNORE
                || (resolution == ReportResolution.RESTRICT_USER && targetType == ReportTargetType.USER)
                || (resolution == ReportResolution.REVIEW_HIDDEN && targetType == ReportTargetType.REVIEW)
                || ((resolution == ReportResolution.TAKE_DOWN || resolution == ReportResolution.RESTORE)
                    && (targetType == ReportTargetType.DEMAND
                        || targetType == ReportTargetType.SERVICE_PACKAGE
                        || targetType == ReportTargetType.MOMENT));
        if (!compatible) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Resolution is incompatible with report target type");
        }
    }

    private Report findReport(Long reportId) {
        validateId(reportId, "reportId");
        return reportRepository.findById(reportId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Report not found"));
    }

    private Report findReportForUpdate(Long reportId) {
        validateId(reportId, "reportId");
        return reportRepository.findByIdForUpdate(reportId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Report not found"));
    }

    private ReportResponse toResponse(Report report) {
        return new ReportResponse(
                report.getId(), report.getReporterId(), report.getTargetType().name(), report.getTargetId(),
                report.getReason(), report.getDescription(), report.getStatus().name(), report.getAdminId(),
                report.getResolution() == null ? null : report.getResolution().name(), report.getAdminComment(),
                report.getCreatedAt(), report.getResolvedAt(), outcome(report), report.getPublicMessage(), report.isFollowUpRequired());
    }

    private ReportResponse toPublicResponse(Report report) {
        return new ReportResponse(report.getId(), report.getReporterId(), report.getTargetType().name(), report.getTargetId(),
                report.getReason(), report.getDescription(), report.getStatus().name(), null,
                report.getResolution() == null ? null : report.getResolution().name(), null,
                report.getCreatedAt(), report.getResolvedAt(), outcome(report), report.getPublicMessage(), report.isFollowUpRequired());
    }

    private Long requireCurrentUser() {
        Long userId = UserContext.getUserId();
        if (userId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return userId;
    }

    private ReportTargetType parseTargetType(String value) {
        return parseEnum(value, ReportTargetType.class, "targetType");
    }

    private ReportTargetType parseOptionalTargetType(String value) {
        return isBlank(value) ? null : parseTargetType(value);
    }

    private ReportStatus parseOptionalStatus(String value) {
        return isBlank(value) ? null : parseEnum(value, ReportStatus.class, "status");
    }

    private ReportResolution parseResolution(String value) {
        return parseEnum(value, ReportResolution.class, "resolution");
    }

    private <E extends Enum<E>> E parseEnum(String value, Class<E> type, String field) {
        if (isBlank(value)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, field + " must not be blank");
        }
        try {
            return Enum.valueOf(type, value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unsupported " + field);
        }
    }

    private String normalizeRequired(String value, int maxLength, String field) {
        String normalized = normalizeOptional(value, maxLength, field);
        if (normalized == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, field + " must not be blank");
        }
        return normalized;
    }

    private String normalizeOptional(String value, int maxLength, String field) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        if (normalized.isEmpty()) {
            return null;
        }
        if (normalized.length() > maxLength) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, field + " is too long");
        }
        return normalized;
    }

    private void validatePage(int page, int size) {
        if (page < 1 || size < 1 || size > 100) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "page must be at least 1 and size must be between 1 and 100");
        }
    }

    private void validateId(Long id, String field) {
        if (id == null || id <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, field + " must be positive");
        }
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

    private String truncateAuditReason(String value) {
        return value.length() <= 500 ? value : value.substring(0, 500);
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
