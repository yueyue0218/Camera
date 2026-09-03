package com.action.camera.admin.service;

import com.action.camera.admin.domain.ModerationStatus;
import com.action.camera.admin.dto.AdminModerationFilter;
import com.action.camera.admin.dto.AdminMomentResponse;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.page.PageResult;
import com.action.camera.report.domain.ReportStatus;
import com.action.camera.report.domain.ReportTargetType;
import com.action.camera.report.repository.ReportRepository;
import com.action.camera.social.domain.MomentPost;
import com.action.camera.social.repository.MomentPostRepository;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
public class AdminMomentService {

    private final AdminPermissionService adminPermissionService;
    private final MomentPostRepository momentPostRepository;
    private final ReportRepository reportRepository;

    public AdminMomentService(AdminPermissionService adminPermissionService,
                              MomentPostRepository momentPostRepository,
                              ReportRepository reportRepository) {
        this.adminPermissionService = adminPermissionService;
        this.momentPostRepository = momentPostRepository;
        this.reportRepository = reportRepository;
    }

    @Transactional(readOnly = true)
    public PageResult<AdminMomentResponse> list(AdminModerationFilter status,
                                                Long authorId,
                                                String keyword,
                                                int page,
                                                int size) {
        adminPermissionService.requireAdmin();
        validatePage(page, size);
        if (authorId != null && authorId <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "authorId must be positive");
        }
        AdminModerationFilter safeStatus = status == null ? AdminModerationFilter.ALL : status;
        String normalizedKeyword = normalizeKeyword(keyword);

        List<AdminMomentResponse> matches = momentPostRepository.findAll(
                        Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))).stream()
                .filter(moment -> authorId == null || authorId.equals(moment.getAuthorId()))
                .filter(moment -> matchesKeyword(moment, normalizedKeyword))
                .map(this::toResponse)
                .filter(moment -> matchesStatus(moment, safeStatus))
                .toList();
        int from = Math.min((page - 1) * size, matches.size());
        int to = Math.min(from + size, matches.size());
        return new PageResult<>(matches.subList(from, to), page, size, matches.size());
    }

    AdminMomentResponse toResponse(MomentPost moment) {
        long pendingReports = reportRepository.countByTargetTypeAndTargetIdAndStatus(
                ReportTargetType.MOMENT, moment.getId(), ReportStatus.PENDING);
        return AdminMomentResponse.from(moment, pendingReports);
    }

    private boolean matchesStatus(AdminMomentResponse moment, AdminModerationFilter status) {
        return switch (status) {
            case ALL -> true;
            case VISIBLE -> ModerationStatus.VISIBLE.name().equals(moment.moderationStatus());
            case HIDDEN -> ModerationStatus.HIDDEN.name().equals(moment.moderationStatus());
            case REPORTED -> moment.pendingReportCount() > 0;
        };
    }

    private boolean matchesKeyword(MomentPost moment, String keyword) {
        if (keyword == null) {
            return true;
        }
        return contains(moment.getTitle(), keyword) || contains(moment.getContent(), keyword);
    }

    private boolean contains(String value, String keyword) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(keyword);
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
        String normalized = keyword.trim().toLowerCase(Locale.ROOT);
        if (normalized.length() > 100) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "keyword is too long");
        }
        return normalized;
    }
}
