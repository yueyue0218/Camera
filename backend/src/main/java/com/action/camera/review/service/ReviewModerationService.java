package com.action.camera.review.service;

import com.action.camera.admin.service.AdminAuditService;
import com.action.camera.application.CreditService;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.review.entity.Review;
import com.action.camera.review.repository.ReviewRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReviewModerationService {
    private static final String CREDIT_EVENT_REVIEW_ARBITRATION_APPROVED = "REVIEW_ARBITRATION_APPROVED";

    private final ReviewRepository reviewRepository;
    private final CreditService creditService;
    private final AdminAuditService adminAuditService;

    public ReviewModerationService(ReviewRepository reviewRepository,
                                   CreditService creditService,
                                   AdminAuditService adminAuditService) {
        this.reviewRepository = reviewRepository;
        this.creditService = creditService;
        this.adminAuditService = adminAuditService;
    }

    @Transactional
    public Review hideForGovernance(Long reviewId,
                                    Long adminId,
                                    String sourceType,
                                    Long sourceId,
                                    String reason) {
        String normalizedSource = normalizeRequired(sourceType, 40, "sourceType");
        String normalizedReason = normalizeRequired(reason, 500, "reason");
        if (reviewId == null || reviewId <= 0 || adminId == null || adminId <= 0
                || sourceId == null || sourceId <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Governance identifiers must be positive");
        }
        Review review = reviewRepository.findByIdForUpdate(reviewId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Review not found"));
        if (!Boolean.TRUE.equals(review.getIsVisible())) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "Review is already hidden");
        }

        review.setIsVisible(false);
        reviewRepository.save(review);
        creditService.reverseCreditAdjustment(
                review.getTargetUserId(),
                "REVIEW",
                review.getId(),
                CREDIT_EVENT_REVIEW_ARBITRATION_APPROVED,
                review.getOrderId(),
                "评价申诉通过，已撤销该评价并回滚其对信用分的影响",
                normalizedSource,
                sourceId,
                calculateReviewScoreChange(review.getRating())
        );
        adminAuditService.record(
                "REVIEW", review.getId(), adminId, "HIDE",
                normalizedSource + "#" + sourceId + ": " + normalizedReason);
        return review;
    }

    private int calculateReviewScoreChange(Integer rating) {
        if (rating == null) {
            return 0;
        }
        return switch (rating) {
            case 5 -> 0;
            case 4 -> -1;
            case 3 -> -2;
            case 2 -> -3;
            case 1 -> -4;
            default -> 0;
        };
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
