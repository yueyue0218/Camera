package com.action.camera.review.service;

import com.action.camera.application.CreditService;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.domain.User;
import com.action.camera.notification.dto.NotificationCreateRequest;
import com.action.camera.notification.service.NotificationService;
import com.action.camera.repository.UserRepository;
import com.action.camera.review.dto.ReviewComplaintArbitrateRequest;
import com.action.camera.review.dto.ReviewComplaintCreateRequest;
import com.action.camera.review.dto.ReviewComplaintResponse;
import com.action.camera.review.entity.Review;
import com.action.camera.review.entity.ReviewComplaint;
import com.action.camera.review.repository.ReviewComplaintRepository;
import com.action.camera.review.repository.ReviewRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ReviewComplaintService {

    private static final String PENDING = "PENDING";
    private static final String PROCESSING = "PROCESSING";
    private static final String RESOLVED = "RESOLVED";
    private static final String CANCELED = "CANCELED";

    private static final String REJECTED = "REJECTED";
    private static final String REVIEW_HIDDEN = "REVIEW_HIDDEN";

    private static final String ADMIN = "ADMIN";
    private static final String ARBITRATOR = "ARBITRATOR";

    private static final String TYPE_COMPLAINT_CREATED = "REVIEW_COMPLAINT_CREATED";
    private static final String TYPE_COMPLAINT_RESOLVED = "REVIEW_COMPLAINT_RESOLVED";
    private static final String RELATED_REVIEW_COMPLAINT = "REVIEW_COMPLAINT";
    private static final String CREDIT_EVENT_REVIEW_ARBITRATION = "REVIEW_ARBITRATION";

    private final ReviewComplaintRepository complaintRepository;
    private final ReviewRepository reviewRepository;
    private final UserRepository userRepository;
    private final CreditService creditService;
    private final NotificationService notificationService;

    public ReviewComplaintService(ReviewComplaintRepository complaintRepository,
                                  ReviewRepository reviewRepository,
                                  UserRepository userRepository,
                                  CreditService creditService,
                                  NotificationService notificationService) {
        this.complaintRepository = complaintRepository;
        this.reviewRepository = reviewRepository;
        this.userRepository = userRepository;
        this.creditService = creditService;
        this.notificationService = notificationService;
    }

    @Transactional
    public ReviewComplaintResponse create(Long reviewId, ReviewComplaintCreateRequest request) {
        Long currentUserId = requireCurrentUserId();
        validateCreateRequest(request);

        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Review not found"));
        if (!currentUserId.equals(review.getTargetUserId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only the reviewed user can complain");
        }
        if (!Boolean.TRUE.equals(review.getIsVisible())) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "Review is already hidden");
        }
        if (complaintRepository.existsByReviewIdAndComplainantIdAndStatusIn(
                reviewId, currentUserId, List.of(PENDING, PROCESSING))) {
            throw new BusinessException(ErrorCode.DUPLICATE_OPERATION, "Complaint already exists");
        }

        LocalDateTime now = LocalDateTime.now();
        ReviewComplaint complaint = new ReviewComplaint();
        complaint.setReviewId(review.getId());
        complaint.setOrderId(review.getOrderId());
        complaint.setComplainantId(currentUserId);
        complaint.setRespondentId(review.getReviewerId());
        complaint.setReason(request.reason().trim());
        complaint.setEvidenceFileIds(trimToNull(request.evidenceFileIds()));
        complaint.setStatus(PENDING);
        complaint.setCreatedAt(now);
        complaint.setUpdatedAt(now);

        ReviewComplaint savedComplaint = complaintRepository.save(complaint);
        notificationService.createNotification(new NotificationCreateRequest(
                review.getReviewerId(),
                "Review complaint submitted",
                "A complaint has been submitted for your review.",
                TYPE_COMPLAINT_CREATED,
                RELATED_REVIEW_COMPLAINT,
                savedComplaint.getId()
        ));

        return toResponse(savedComplaint);
    }

    @Transactional(readOnly = true)
    public List<ReviewComplaintResponse> listMine() {
        Long currentUserId = requireCurrentUserId();
        return complaintRepository.findByComplainantIdOrderByCreatedAtDesc(currentUserId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ReviewComplaintResponse> listByReview(Long reviewId) {
        Long currentUserId = requireCurrentUserId();
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Review not found"));
        if (!currentUserId.equals(review.getReviewerId())
                && !currentUserId.equals(review.getTargetUserId())
                && !isArbitrator(currentUserId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "No permission to view complaints");
        }
        return complaintRepository.findByReviewIdOrderByCreatedAtDesc(reviewId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ReviewComplaintResponse> listForArbitration(String status) {
        requireArbitrator(requireCurrentUserId());
        if (isBlank(status)) {
            return complaintRepository.findAllByOrderByCreatedAtDesc().stream()
                    .map(this::toResponse)
                    .toList();
        }
        return complaintRepository.findByStatusOrderByCreatedAtAsc(status.trim()).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ReviewComplaintResponse cancel(Long complaintId) {
        Long currentUserId = requireCurrentUserId();
        ReviewComplaint complaint = complaintRepository.findById(complaintId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Complaint not found"));
        if (!currentUserId.equals(complaint.getComplainantId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only complainant can cancel");
        }
        if (!PENDING.equals(complaint.getStatus())) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "Only pending complaints can be canceled");
        }
        complaint.setStatus(CANCELED);
        complaint.setUpdatedAt(LocalDateTime.now());
        return toResponse(complaint);
    }

    @Transactional
    public ReviewComplaintResponse arbitrate(Long complaintId, ReviewComplaintArbitrateRequest request) {
        Long currentUserId = requireCurrentUserId();
        requireArbitrator(currentUserId);
        validateArbitrateRequest(request);

        ReviewComplaint complaint = complaintRepository.findById(complaintId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Complaint not found"));
        if (!PENDING.equals(complaint.getStatus()) && !PROCESSING.equals(complaint.getStatus())) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "Complaint has been handled");
        }

        Review review = reviewRepository.findById(complaint.getReviewId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Review not found"));

        LocalDateTime now = LocalDateTime.now();
        complaint.setStatus(RESOLVED);
        String result = request.result().trim();
        complaint.setArbitrationResult(result);
        complaint.setArbitrationComment(trimToNull(request.comment()));
        complaint.setHandledBy(currentUserId);
        complaint.setHandledAt(now);
        complaint.setUpdatedAt(now);

        if (REVIEW_HIDDEN.equals(result) && Boolean.TRUE.equals(review.getIsVisible())) {
            review.setIsVisible(false);
            creditService.updateCreditScore(
                    review.getTargetUserId(),
                    -calculateReviewScoreChange(review.getRating()),
                    CREDIT_EVENT_REVIEW_ARBITRATION,
                    review.getOrderId(),
                    "Review arbitration adjusted credit"
            );
        }

        ReviewComplaint savedComplaint = complaintRepository.save(complaint);
        notifyResolved(savedComplaint);
        return toResponse(savedComplaint);
    }

    private void validateCreateRequest(ReviewComplaintCreateRequest request) {
        if (request == null || isBlank(request.reason())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Complaint reason is required");
        }
        if (request.reason().trim().length() > 1000) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Complaint reason is too long");
        }
    }

    private void validateArbitrateRequest(ReviewComplaintArbitrateRequest request) {
        if (request == null || isBlank(request.result())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Arbitration result is required");
        }
        String result = request.result().trim();
        if (!REJECTED.equals(result) && !REVIEW_HIDDEN.equals(result)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unsupported arbitration result");
        }
        if (request.comment() != null && request.comment().trim().length() > 1000) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Arbitration comment is too long");
        }
    }

    private void requireArbitrator(Long userId) {
        if (!isArbitrator(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Arbitrator permission required");
        }
    }

    private boolean isArbitrator(Long userId) {
        return userRepository.findById(userId)
                .map(User::getCurrentRole)
                .map(role -> ADMIN.equals(role) || ARBITRATOR.equals(role))
                .orElse(false);
    }

    private void notifyResolved(ReviewComplaint complaint) {
        notificationService.createNotification(new NotificationCreateRequest(
                complaint.getComplainantId(),
                "Review complaint resolved",
                "Your review complaint has been resolved.",
                TYPE_COMPLAINT_RESOLVED,
                RELATED_REVIEW_COMPLAINT,
                complaint.getId()
        ));
        notificationService.createNotification(new NotificationCreateRequest(
                complaint.getRespondentId(),
                "Review complaint resolved",
                "A complaint related to your review has been resolved.",
                TYPE_COMPLAINT_RESOLVED,
                RELATED_REVIEW_COMPLAINT,
                complaint.getId()
        ));
    }

    private int calculateReviewScoreChange(Integer rating) {
        return switch (rating) {
            case 5 -> 2;
            case 4 -> 1;
            case 3 -> 0;
            case 2 -> -2;
            case 1 -> -5;
            default -> throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Rating must be between 1 and 5");
        };
    }

    private ReviewComplaintResponse toResponse(ReviewComplaint complaint) {
        return new ReviewComplaintResponse(
                complaint.getId(),
                complaint.getReviewId(),
                complaint.getOrderId(),
                complaint.getComplainantId(),
                complaint.getRespondentId(),
                complaint.getReason(),
                complaint.getEvidenceFileIds(),
                complaint.getStatus(),
                complaint.getArbitrationResult(),
                complaint.getArbitrationComment(),
                complaint.getHandledBy(),
                complaint.getCreatedAt(),
                complaint.getUpdatedAt(),
                complaint.getHandledAt()
        );
    }

    private Long requireCurrentUserId() {
        Long currentUserId = UserContext.getUserId();
        if (currentUserId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return currentUserId;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String trimToNull(String value) {
        if (isBlank(value)) {
            return null;
        }
        return value.trim();
    }
}
