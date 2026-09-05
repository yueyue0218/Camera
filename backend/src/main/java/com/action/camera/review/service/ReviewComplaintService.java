package com.action.camera.review.service;

import com.action.camera.admin.service.AdminPermissionService;
import com.action.camera.admin.service.AdminAuditService;
import com.action.camera.application.CreditService;
import com.action.camera.application.OrderDisplayService;
import com.action.camera.application.UserDisplayService;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.notification.dto.NotificationCreateRequest;
import com.action.camera.notification.service.NotificationService;
import com.action.camera.review.dto.ReviewComplaintArbitrateRequest;
import com.action.camera.review.dto.ReviewComplaintCreateRequest;
import com.action.camera.review.dto.ReviewComplaintResponse;
import com.action.camera.review.entity.Review;
import com.action.camera.review.entity.ReviewComplaint;
import com.action.camera.review.repository.ReviewComplaintRepository;
import com.action.camera.review.repository.ReviewRepository;
import com.action.camera.review.port.EvidenceFileMetadata;
import com.action.camera.review.port.EvidenceFileQueryPort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public class ReviewComplaintService {

    private static final String PENDING = "PENDING";
    private static final String RESOLVED = "RESOLVED";
    private static final String CANCELED = "CANCELED";

    private static final String REJECTED = "REJECTED";
    private static final String REVIEW_HIDDEN = "REVIEW_HIDDEN";

    private static final String TYPE_COMPLAINT_CREATED = "REVIEW_COMPLAINT_CREATED";
    private static final String TYPE_COMPLAINT_RESOLVED = "REVIEW_COMPLAINT_RESOLVED";
    private static final String RELATED_REVIEW_COMPLAINT = "REVIEW_COMPLAINT";
    private static final String CREDIT_EVENT_REVIEW_ARBITRATION_REJECTED = "REVIEW_ARBITRATION_REJECTED";
    private static final int MAX_EVIDENCE_FILE_COUNT = 5;

    private final ReviewComplaintRepository complaintRepository;
    private final ReviewRepository reviewRepository;
    private final CreditService creditService;
    private final OrderDisplayService orderDisplayService;
    private final UserDisplayService userDisplayService;
    private final NotificationService notificationService;
    private final EvidenceFileQueryPort evidenceFileQueryPort;
    private final AdminPermissionService adminPermissionService;
    private final ReviewModerationService reviewModerationService;
    private final AdminAuditService adminAuditService;

    public ReviewComplaintService(ReviewComplaintRepository complaintRepository,
                                  ReviewRepository reviewRepository,
                                  CreditService creditService,
                                  OrderDisplayService orderDisplayService,
                                  UserDisplayService userDisplayService,
                                  NotificationService notificationService,
                                  EvidenceFileQueryPort evidenceFileQueryPort,
                                  AdminPermissionService adminPermissionService,
                                  ReviewModerationService reviewModerationService,
                                  AdminAuditService adminAuditService) {
        this.complaintRepository = complaintRepository;
        this.reviewRepository = reviewRepository;
        this.creditService = creditService;
        this.orderDisplayService = orderDisplayService;
        this.userDisplayService = userDisplayService;
        this.notificationService = notificationService;
        this.evidenceFileQueryPort = evidenceFileQueryPort;
        this.adminPermissionService = adminPermissionService;
        this.reviewModerationService = reviewModerationService;
        this.adminAuditService = adminAuditService;
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
                reviewId, currentUserId, List.of(PENDING))) {
            throw new BusinessException(ErrorCode.DUPLICATE_OPERATION, "Complaint already exists");
        }

        LocalDateTime now = LocalDateTime.now();
        String evidenceFileIds = normalizeEvidenceFileIds(request.evidenceFileIds(), currentUserId);
        ReviewComplaint complaint = new ReviewComplaint();
        complaint.setReviewId(review.getId());
        complaint.setOrderId(review.getOrderId());
        complaint.setComplainantId(currentUserId);
        complaint.setRespondentId(review.getReviewerId());
        complaint.setReason(request.reason().trim());
        complaint.setEvidenceFileIds(evidenceFileIds);
        complaint.setStatus(PENDING);
        complaint.setCreatedAt(now);
        complaint.setUpdatedAt(now);

        ReviewComplaint savedComplaint = complaintRepository.save(complaint);
        String complainantName = resolveComplainantNickname(savedComplaint, review);
        String respondentName = resolveRespondentNickname(savedComplaint, review);
        String orderSubject = orderDisplayService.resolveOrderSubject(review.getOrderId());
        notificationService.createNotification(new NotificationCreateRequest(
                review.getReviewerId(),
                currentUserId,
                orderSubject + " 收到一条评价申诉",
                complainantName + " 针对你在" + orderSubject + "中的评价发起了申诉，可前往订单详情查看处理进展。",
                TYPE_COMPLAINT_CREATED,
                TYPE_COMPLAINT_CREATED,
                RELATED_REVIEW_COMPLAINT,
                savedComplaint.getId(),
                RELATED_REVIEW_COMPLAINT,
                savedComplaint.getId(),
                RELATED_REVIEW_COMPLAINT,
                savedComplaint.getId(),
                "review-complaint:created:" + savedComplaint.getId(),
                buildComplaintMetadata(savedComplaint)
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
    public ReviewComplaintResponse detail(Long complaintId) {
        Long currentUserId = requireCurrentUserId();
        ReviewComplaint complaint = complaintRepository.findByIdForUpdate(complaintId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Complaint not found"));
        if (!currentUserId.equals(complaint.getComplainantId())
                && !currentUserId.equals(complaint.getRespondentId())
                && !isAdmin(currentUserId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "No permission to view complaint");
        }
        return toResponse(complaint);
    }

    @Transactional(readOnly = true)
    public List<ReviewComplaintResponse> listByReview(Long reviewId) {
        Long currentUserId = requireCurrentUserId();
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Review not found"));
        if (!currentUserId.equals(review.getReviewerId())
                && !currentUserId.equals(review.getTargetUserId())
                && !isAdmin(currentUserId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "No permission to view complaints");
        }
        return complaintRepository.findByReviewIdOrderByCreatedAtDesc(reviewId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ReviewComplaintResponse> listForArbitration(String status) {
        requireAdmin(requireCurrentUserId());
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
        requireAdmin(currentUserId);
        validateArbitrateRequest(request);

        ReviewComplaint complaint = complaintRepository.findByIdForUpdate(complaintId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Complaint not found"));
        if (!PENDING.equals(complaint.getStatus())) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "Complaint has been handled");
        }

        LocalDateTime now = LocalDateTime.now();
        complaint.setStatus(RESOLVED);
        String result = request.result().trim();
        String comment = request.comment().trim();
        complaint.setArbitrationResult(result);
        complaint.setArbitrationComment(comment);
        complaint.setHandledBy(currentUserId);
        complaint.setHandledAt(now);
        complaint.setUpdatedAt(now);

        Review review;
        if (REVIEW_HIDDEN.equals(result)) {
            review = reviewModerationService.hideForGovernance(
                    complaint.getReviewId(), currentUserId,
                    RELATED_REVIEW_COMPLAINT, complaint.getId(), comment);
        } else {
            review = reviewRepository.findById(complaint.getReviewId())
                    .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Review not found"));
            creditService.updateCreditScore(
                    review.getTargetUserId(),
                    0,
                    CREDIT_EVENT_REVIEW_ARBITRATION_REJECTED,
                    review.getOrderId(),
                    "评价申诉被驳回，原评价影响继续生效",
                    CREDIT_EVENT_REVIEW_ARBITRATION_REJECTED,
                    complaint.getId()
            );
        }

        ReviewComplaint savedComplaint = complaintRepository.save(complaint);
        adminAuditService.record(
                RELATED_REVIEW_COMPLAINT,
                savedComplaint.getId(),
                currentUserId,
                "ARBITRATE",
                truncateAuditReason(result + ": " + comment));
        notifyResolved(savedComplaint, review);
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

    private String normalizeEvidenceFileIds(String evidenceFileIds, Long currentUserId) {
        if (isBlank(evidenceFileIds)) {
            return null;
        }
        Set<Long> parsedIds = new LinkedHashSet<>();
        for (String rawId : evidenceFileIds.split(",")) {
            String value = rawId.trim();
            if (value.isEmpty()) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Evidence file id is required");
            }
            Long fileId = parseEvidenceFileId(value);
            if (!parsedIds.add(fileId)) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Duplicate evidence file id is not allowed");
            }
            if (parsedIds.size() > MAX_EVIDENCE_FILE_COUNT) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "At most 5 evidence files are allowed");
            }
        }
        for (Long fileId : parsedIds) {
            validateEvidenceFile(fileId, currentUserId);
        }
        return String.join(",", parsedIds.stream().map(String::valueOf).toList());
    }

    private Long parseEvidenceFileId(String value) {
        try {
            long fileId = Long.parseLong(value);
            if (fileId <= 0) {
                throw new NumberFormatException("file id must be positive");
            }
            return fileId;
        } catch (NumberFormatException e) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Evidence file id must be a positive number");
        }
    }

    private void validateEvidenceFile(Long fileId, Long currentUserId) {
        EvidenceFileMetadata file = evidenceFileQueryPort.findById(fileId)
                .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "Evidence file not found"));
        if (file.deleted()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Deleted evidence file cannot be used");
        }
        if (!currentUserId.equals(file.uploaderId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only files uploaded by current user can be used as evidence");
        }
        if (!isAllowedEvidenceMimeType(file.mimeType())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Evidence file must be an image or PDF");
        }
    }

    private boolean isAllowedEvidenceMimeType(String mimeType) {
        if (mimeType == null || mimeType.isBlank()) {
            return false;
        }
        String normalized = mimeType.trim().toLowerCase();
        return normalized.startsWith("image/") || "application/pdf".equals(normalized);
    }

    private void validateArbitrateRequest(ReviewComplaintArbitrateRequest request) {
        if (request == null || isBlank(request.result())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Arbitration result is required");
        }
        String result = request.result().trim();
        if (!REJECTED.equals(result) && !REVIEW_HIDDEN.equals(result)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unsupported arbitration result");
        }
        if (isBlank(request.comment())) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Arbitration comment is required");
        }
        if (request.comment().trim().length() > 1000) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Arbitration comment is too long");
        }
    }

    private void requireAdmin(Long userId) {
        if (!isAdmin(userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Admin permission required");
        }
    }

    private boolean isAdmin(Long userId) {
        return adminPermissionService.hasAdminPermission(userId);
    }

    private void notifyResolved(ReviewComplaint complaint, Review review) {
        String complainantName = resolveComplainantNickname(complaint, review);
        String respondentName = resolveRespondentNickname(complaint, review);
        boolean approved = REVIEW_HIDDEN.equals(complaint.getArbitrationResult());
        String orderSubject = orderDisplayService.resolveOrderSubject(complaint.getOrderId());
        String title = orderSubject + (approved ? " 评价申诉已通过" : " 评价申诉已驳回");
        String complainantContent = approved
                ? "你针对" + orderSubject + "的评价申诉已通过，该评价已被隐藏并撤销其信用影响。"
                : "你针对" + orderSubject + "的评价申诉已被驳回，原评价将继续保留并按规则生效。";
        String respondentContent = approved
                ? complainantName + " 针对" + orderSubject + "的评价申诉已通过，你留下的相关评价已被隐藏。"
                : complainantName + " 针对" + orderSubject + "的评价申诉已被驳回，你留下的评价继续保留。";
        notificationService.createNotification(new NotificationCreateRequest(
                complaint.getComplainantId(),
                complaint.getHandledBy(),
                title,
                complainantContent,
                TYPE_COMPLAINT_RESOLVED,
                TYPE_COMPLAINT_RESOLVED,
                RELATED_REVIEW_COMPLAINT,
                complaint.getId(),
                RELATED_REVIEW_COMPLAINT,
                complaint.getId(),
                RELATED_REVIEW_COMPLAINT,
                complaint.getId(),
                "review-complaint:resolved:complainant:" + complaint.getId(),
                buildComplaintMetadata(complaint)
        ));
        notificationService.createNotification(new NotificationCreateRequest(
                complaint.getRespondentId(),
                complaint.getHandledBy(),
                title,
                respondentContent,
                TYPE_COMPLAINT_RESOLVED,
                TYPE_COMPLAINT_RESOLVED,
                RELATED_REVIEW_COMPLAINT,
                complaint.getId(),
                RELATED_REVIEW_COMPLAINT,
                complaint.getId(),
                RELATED_REVIEW_COMPLAINT,
                complaint.getId(),
                "review-complaint:resolved:respondent:" + complaint.getId(),
                buildComplaintMetadata(complaint)
        ));
    }

    private ReviewComplaintResponse toResponse(ReviewComplaint complaint) {
        return new ReviewComplaintResponse(
                complaint.getId(),
                complaint.getReviewId(),
                complaint.getOrderId(),
                complaint.getComplainantId(),
                resolveComplainantNickname(complaint, null),
                complaint.getRespondentId(),
                resolveRespondentNickname(complaint, null),
                complaint.getReason(),
                complaint.getEvidenceFileIds(),
                complaint.getStatus(),
                complaint.getArbitrationResult(),
                complaint.getArbitrationComment(),
                complaint.getHandledBy(),
                resolveHandledByNickname(complaint),
                complaint.getCreatedAt(),
                complaint.getUpdatedAt(),
                complaint.getHandledAt()
        );
    }

    private String resolveComplainantNickname(ReviewComplaint complaint, Review review) {
        if (review != null && complaint.getComplainantId() != null && complaint.getComplainantId().equals(review.getTargetUserId())) {
            return userDisplayService.resolveDisplayName(complaint.getComplainantId(), targetRole(review));
        }
        return userDisplayService.resolveDisplayName(complaint.getComplainantId(), "");
    }

    private String resolveRespondentNickname(ReviewComplaint complaint, Review review) {
        if (review != null && complaint.getRespondentId() != null && complaint.getRespondentId().equals(review.getReviewerId())) {
            return userDisplayService.resolveDisplayName(complaint.getRespondentId(), reviewerRole(review));
        }
        return userDisplayService.resolveDisplayName(complaint.getRespondentId(), "");
    }

    private String resolveHandledByNickname(ReviewComplaint complaint) {
        if (complaint.getHandledBy() == null) {
            return null;
        }
        return userDisplayService.resolveDisplayName(complaint.getHandledBy(), "");
    }

    private String reviewerRole(Review review) {
        return switch (String.valueOf(review.getDirection()).trim().toUpperCase()) {
            case "CUSTOMER_TO_PROVIDER" -> "CUSTOMER";
            case "PROVIDER_TO_CUSTOMER" -> "PROVIDER";
            default -> "";
        };
    }

    private String targetRole(Review review) {
        return switch (String.valueOf(review.getDirection()).trim().toUpperCase()) {
            case "CUSTOMER_TO_PROVIDER" -> "PROVIDER";
            case "PROVIDER_TO_CUSTOMER" -> "CUSTOMER";
            default -> "";
        };
    }

    private String buildComplaintMetadata(ReviewComplaint complaint) {
        return String.format(
                "{\"orderId\":%d,\"reviewId\":%d,\"complaintId\":%d,\"navigationPath\":\"/orders?orderId=%d&section=reviews\"}",
                complaint.getOrderId(),
                complaint.getReviewId(),
                complaint.getId(),
                complaint.getOrderId()
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

    private String truncateAuditReason(String value) {
        return value.length() <= 500 ? value : value.substring(0, 500);
    }
}
