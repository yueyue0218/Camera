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
        if (!COMPLETED.equals(order.getStatus())) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "订单完成后才能评价");
        }

        ReviewTarget target = resolveReviewTarget(order, currentUserId);
        if (reviewRepository.findByOrderIdAndDirection(orderId, target.direction()).isPresent()) {
            throw new BusinessException(ErrorCode.DUPLICATE_OPERATION, "该订单已评价过");
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
                "收到订单评价"
        );
        notificationService.createNotification(new NotificationCreateRequest(
                savedReview.getTargetUserId(),
                "收到新的评价",
                "你收到了一条新的订单评价",
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
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有订单双方可以查看订单评价");
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
        if (reviewerId.equals(order.getCustomerId())) {
            if (reviewerId.equals(order.getProviderId())) {
                throw new BusinessException(ErrorCode.STATUS_CONFLICT, "不能评价自己");
            }
            return new ReviewTarget(order.getProviderId(), CUSTOMER_TO_PROVIDER);
        }
        if (reviewerId.equals(order.getProviderId())) {
            return new ReviewTarget(order.getCustomerId(), PROVIDER_TO_CUSTOMER);
        }
        throw new BusinessException(ErrorCode.FORBIDDEN, "只有订单双方可以评价");
    }

    private void validateRequest(ReviewCreateRequest request) {
        if (request == null || request.rating() == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "评分不能为空");
        }
        if (request.rating() < 1 || request.rating() > 5) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "评分必须在 1-5 之间");
        }
    }

    private int calculateReviewScoreChange(Integer rating) {
        return switch (rating) {
            case 5 -> 2;
            case 4 -> 1;
            case 3 -> 0;
            case 2 -> -2;
            case 1 -> -5;
            default -> throw new BusinessException(ErrorCode.VALIDATION_ERROR, "评分必须在 1-5 之间");
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
}
