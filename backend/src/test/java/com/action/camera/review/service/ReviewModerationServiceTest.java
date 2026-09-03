package com.action.camera.review.service;

import com.action.camera.admin.service.AdminAuditService;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.application.CreditService;
import com.action.camera.review.entity.Review;
import com.action.camera.review.repository.ReviewRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReviewModerationServiceTest {

    @Mock ReviewRepository reviewRepository;
    @Mock CreditService creditService;
    @Mock AdminAuditService adminAuditService;

    private ReviewModerationService service;
    private Review review;

    @BeforeEach
    void setUp() {
        service = new ReviewModerationService(reviewRepository, creditService, adminAuditService);
        review = new Review();
        review.setId(31L);
        review.setOrderId(41L);
        review.setTargetUserId(51L);
        review.setRating(4);
        review.setIsVisible(true);
        when(reviewRepository.findByIdForUpdate(31L)).thenReturn(Optional.of(review));
    }

    @Test
    void hideReviewMarksItInvisibleAndReversesCreditExactlyOnce() {
        service.hideForGovernance(31L, 61L, "REPORT", 71L, " confirmed ");

        assertThat(review.getIsVisible()).isFalse();
        verify(reviewRepository).save(review);
        verify(creditService).reverseCreditAdjustment(
                51L, "REVIEW", 31L, "REVIEW_ARBITRATION_APPROVED", 41L,
                "评价申诉通过，已撤销该评价并回滚其对信用分的影响",
                "REPORT", 71L, -1);
    }

    @Test
    void alreadyHiddenReviewFailsWithoutSecondCreditReversal() {
        review.setIsVisible(false);

        assertThatThrownBy(() -> service.hideForGovernance(31L, 61L, "REPORT", 71L, "confirmed"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.STATUS_CONFLICT);
        verify(creditService, never()).reverseCreditAdjustment(
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyInt());
        verify(adminAuditService, never()).record(
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any());
    }

    @Test
    void reviewHideWritesReviewAuditWhenCalledFromReportResolution() {
        service.hideForGovernance(31L, 61L, "REPORT", 71L, " confirmed ");

        verify(adminAuditService).record("REVIEW", 31L, 61L, "HIDE", "REPORT#71: confirmed");
    }
}
