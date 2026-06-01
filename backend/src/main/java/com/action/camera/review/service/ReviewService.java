package com.action.camera.review.service;

import com.action.camera.application.CreditService;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.delivery.port.OrderQueryPort;
import com.action.camera.delivery.port.OrderSnapshot;
import com.action.camera.notification.dto.NotificationCreateRequest;
import com.action.camera.notification.service.NotificationService;
import com.action.camera.review.dto.ReviewCreateRequest;
import com.action.camera.review.dto.ReviewResponse;
import com.action.camera.review.entity.Review;
import com.action.camera.review.repository.ReviewRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ReviewService {

    private static final String COMPLETED = "COMPLETED";
    private static final String REFUNDED = "REFUNDED";
    private static final String CUSTOMER_TO_PROVIDER = "CUSTOMER_TO_PROVIDER";
    private static final String PROVIDER_TO_CUSTOMER = "PROVIDER_TO_CUSTOMER";
    private static final String REVIEW_RECEIVED = "REVIEW_RECEIVED";
    private static final String RELATED_ORDER = "ORDER";
    private static final String CREDIT_EVENT_REVIEW = "REVIEW";

    private final ReviewRepository reviewRepository;
    private final OrderQueryPort orderQueryPort;
    private final CreditService creditService;
    private final NotificationService notificationService;

    public ReviewService(ReviewRepository reviewRepository,
                         OrderQueryPort orderQueryPort,
                         CreditService creditService,
                         NotificationService notificationService) {
        this.reviewRepository = reviewRepository;
        this.orderQueryPort = orderQueryPort;
        this.creditService = creditService;
        this.notificationService = notificationService;
    }

    @Transactional
    public ReviewResponse create(Long orderId, ReviewCreateRequest request) {
        Long currentUserId = requireCurrentUserId();
        validateRequest(request);

        OrderSnapshot order = orderQueryPort.getOrderSnapshot(orderId);
        ReviewTarget target = resolveReviewTarget(order, currentUserId);
        if (reviewRepository.findByOrderIdAndDirection(orderId, target.direction()).isPresent()) {
            throw new BusinessException(ErrorCode.DUPLICATE_OPERATION, "This order direction has already been reviewed");
        }

        Review review = new Review();
        review.setOrderId(orderId);
        review.setReviewerId(currentUserId);
        review.setTargetUserId(target.targetUserId());
        review.setDirection(target.direction());
        review.setRating(request.rating());
        review.setContent(request.content());
        review.setIsVisible(true);
        review.setCreatedAt(LocalDateTime.now());

        Review savedReview = reviewRepository.save(review);
        creditService.updateCreditScore(
                savedReview.getTargetUserId(),
                calculateReviewScoreChange(savedReview.getRating()),
                CREDIT_EVENT_REVIEW,
                savedReview.getOrderId(),
                "Received order review"
        );
        notificationService.createNotification(new NotificationCreateRequest(
                savedReview.getTargetUserId(),
                "New review received",
                "You have received a new order review.",
                REVIEW_RECEIVED,
                RELATED_ORDER,
                savedReview.getOrderId()
        ));

        return toResponse(savedReview);
    }

    @Transactional(readOnly = true)
    public List<ReviewResponse> listByOrder(Long orderId) {
        Long currentUserId = requireCurrentUserId();
        OrderSnapshot order = orderQueryPort.getOrderSnapshot(orderId);
        if (!currentUserId.equals(order.getCustomerId()) && !currentUserId.equals(order.getProviderId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only order participants can view order reviews");
        }
        return reviewRepository.findByOrderIdOrderByCreatedAtDesc(orderId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ReviewResponse> listReceivedByUser(Long userId) {
        requireCurrentUserId();
        return reviewRepository.findByTargetUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    private ReviewTarget resolveReviewTarget(OrderSnapshot order, Long reviewerId) {
        if (COMPLETED.equals(order.getStatus())) {
            return resolveParticipantReviewTarget(order, reviewerId);
        }
        if (REFUNDED.equals(order.getStatus())) {
            return resolveRefundResponsibilityReviewTarget(order, reviewerId);
        }
        throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                "Order can be reviewed only after completion or fault-based refund resolution");
    }

    private ReviewTarget resolveParticipantReviewTarget(OrderSnapshot order, Long reviewerId) {
        if (reviewerId.equals(order.getCustomerId())) {
            if (reviewerId.equals(order.getProviderId())) {
                throw new BusinessException(ErrorCode.STATUS_CONFLICT, "Cannot review yourself");
            }
            return new ReviewTarget(order.getProviderId(), CUSTOMER_TO_PROVIDER);
        }
        if (reviewerId.equals(order.getProviderId())) {
            return new ReviewTarget(order.getCustomerId(), PROVIDER_TO_CUSTOMER);
        }
        throw new BusinessException(ErrorCode.FORBIDDEN, "Only order participants can create a review");
    }

    private ReviewTarget resolveRefundResponsibilityReviewTarget(OrderSnapshot order, Long reviewerId) {
        RefundResolution resolution = RefundResolution.from(order.getRefundStatus());
        return switch (resolution) {
            case PROVIDER_FAULT -> {
                ensureCustomer(order, reviewerId);
                yield new ReviewTarget(order.getProviderId(), CUSTOMER_TO_PROVIDER);
            }
            case CUSTOMER_FAULT -> {
                ensureProvider(order, reviewerId);
                yield new ReviewTarget(order.getCustomerId(), PROVIDER_TO_CUSTOMER);
            }
            case BOTH_FAULT -> resolveParticipantReviewTarget(order, reviewerId);
            case MUTUAL_AGREEMENT, NO_FAULT, UNDETERMINED, NONE -> throw new BusinessException(
                    ErrorCode.STATUS_CONFLICT,
                    "Refund order can be reviewed only when a fault party is determined"
            );
        };
    }

    private void ensureCustomer(OrderSnapshot order, Long reviewerId) {
        if (!reviewerId.equals(order.getCustomerId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only the non-fault customer can review this refund responsibility");
        }
    }

    private void ensureProvider(OrderSnapshot order, Long reviewerId) {
        if (!reviewerId.equals(order.getProviderId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only the non-fault provider can review this refund responsibility");
        }
    }

    private void validateRequest(ReviewCreateRequest request) {
        if (request == null || request.rating() == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Rating is required");
        }
        if (request.rating() < 1 || request.rating() > 5) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Rating must be between 1 and 5");
        }
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

    private ReviewResponse toResponse(Review review) {
        return new ReviewResponse(
                review.getId(),
                review.getOrderId(),
                review.getReviewerId(),
                review.getTargetUserId(),
                review.getDirection(),
                review.getRating(),
                review.getContent(),
                review.getIsVisible(),
                review.getCreatedAt()
        );
    }

    private Long requireCurrentUserId() {
        Long currentUserId = UserContext.getUserId();
        if (currentUserId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return currentUserId;
    }

    private record ReviewTarget(Long targetUserId, String direction) {
    }

    private enum RefundResolution {
        PROVIDER_FAULT,
        CUSTOMER_FAULT,
        BOTH_FAULT,
        MUTUAL_AGREEMENT,
        NO_FAULT,
        UNDETERMINED,
        NONE;

        static RefundResolution from(String value) {
            if (value == null || value.isBlank()) {
                return NONE;
            }
            return switch (value.trim().toUpperCase()) {
                case "PROVIDER_FAULT", "REFUNDED_PROVIDER_FAULT" -> PROVIDER_FAULT;
                case "CUSTOMER_FAULT", "REFUNDED_CUSTOMER_FAULT" -> CUSTOMER_FAULT;
                case "BOTH_FAULT", "REFUNDED_BOTH_FAULT" -> BOTH_FAULT;
                case "MUTUAL_AGREEMENT", "REFUNDED_MUTUAL_AGREEMENT" -> MUTUAL_AGREEMENT;
                case "NO_FAULT", "REFUNDED_NO_FAULT" -> NO_FAULT;
                case "UNDETERMINED", "REFUNDED_UNDETERMINED" -> UNDETERMINED;
                default -> NONE;
            };
        }
    }
}
