package com.action.camera.credit.controller;

import com.action.camera.application.CreditService;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.Result;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.credit.dto.CreditRecordResponse;
import com.action.camera.credit.dto.CreditSummaryResponse;
import com.action.camera.domain.CreditRecord;
import com.action.camera.domain.User;
import com.action.camera.order.enums.OrderStatus;
import com.action.camera.order.repository.OrderRepository;
import com.action.camera.repository.UserRepository;
import com.action.camera.review.entity.Review;
import com.action.camera.review.repository.ReviewRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

@RestController
public class CreditController {

    private final CreditService creditService;
    private final UserRepository userRepository;
    private final OrderRepository orderRepository;
    private final ReviewRepository reviewRepository;

    public CreditController(CreditService creditService,
                            UserRepository userRepository,
                            OrderRepository orderRepository,
                            ReviewRepository reviewRepository) {
        this.creditService = creditService;
        this.userRepository = userRepository;
        this.orderRepository = orderRepository;
        this.reviewRepository = reviewRepository;
    }

    @GetMapping("/users/{userId}/credit")
    public Result<CreditSummaryResponse> getCreditSummary(@PathVariable Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "用户不存在"));
        List<CreditRecord> records = creditService.getCreditHistory(user.getId());
        CreditSnapshot snapshot = buildCreditSnapshot(user.getId(), records);

        return Result.success(new CreditSummaryResponse(
                user.getId(),
                snapshot.creditScore(),
                resolveCreditLevel(snapshot.creditScore(), snapshot.effectiveOrderCount(), snapshot.receivedReviewCount()),
                (long) records.size(),
                records.isEmpty() ? null : records.get(0).getCreatedAt(),
                snapshot.effectiveOrderCount(),
                snapshot.completedOrderCount(),
                snapshot.goodReviewRate(),
                snapshot.fulfillmentRate(),
                snapshot.riskRecordCount(),
                snapshot.receivedReviewCount(),
                snapshot.averageRating()
        ));
    }

    @GetMapping("/users/{userId}/credit-records")
    public Result<List<CreditRecordResponse>> listCreditRecords(@PathVariable Long userId) {
        requireSelfOrAdmin(userId);
        return Result.success(creditService.getCreditHistory(userId).stream()
                .map(this::toResponse)
                .toList());
    }

    private CreditRecordResponse toResponse(CreditRecord record) {
        return new CreditRecordResponse(
                record.getId(),
                record.getUserId(),
                record.getRelatedOrderId(),
                record.getEventType(),
                record.getScoreChange(),
                record.getBeforeScore(),
                record.getScoreAfter(),
                record.getAfterScore(),
                record.getAppliedScoreChange(),
                record.getSourceType(),
                record.getSourceId(),
                record.getReason(),
                record.getCreatedAt()
        );
    }

    private void requireSelfOrAdmin(Long userId) {
        Long currentUserId = UserContext.getUserId();
        if (currentUserId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        if (currentUserId.equals(userId) || UserContext.isAdmin()) {
            return;
        }
        throw new BusinessException(ErrorCode.FORBIDDEN, "只能查看自己的信用记录");
    }

    private CreditSnapshot buildCreditSnapshot(Long userId, List<CreditRecord> records) {
        Set<OrderStatus> effectiveStatuses = EnumSet.of(OrderStatus.COMPLETED, OrderStatus.REFUNDED, OrderStatus.CANCELLED);
        long effectiveOrders = orderRepository.countByCustomerIdAndStatusIn(userId, effectiveStatuses)
                + orderRepository.countByProviderUserIdAndStatusIn(userId, effectiveStatuses);
        long completedOrders = orderRepository.countByCustomerIdAndStatus(userId, OrderStatus.COMPLETED)
                + orderRepository.countByProviderUserIdAndStatus(userId, OrderStatus.COMPLETED);

        List<Review> reviews = reviewRepository.findByTargetUserIdAndIsVisibleTrueOrderByCreatedAtDesc(userId);
        long reviewCount = reviews.size();
        long goodReviewCount = reviews.stream()
                .filter(review -> review.getRating() != null && review.getRating() >= 4)
                .count();
        BigDecimal averageRating = reviewCount == 0
                ? null
                : BigDecimal.valueOf(reviews.stream()
                        .filter(review -> review.getRating() != null)
                        .mapToInt(Review::getRating)
                        .average()
                        .orElse(0))
                .setScale(1, RoundingMode.HALF_UP);
        BigDecimal goodReviewRate = reviewCount == 0 ? null : percent(goodReviewCount, reviewCount);
        BigDecimal fulfillmentRate = effectiveOrders == 0 ? null : percent(completedOrders, effectiveOrders);

        long negativeCreditRecords = records.stream()
                .filter(record -> record.getAppliedScoreChange() != null && record.getAppliedScoreChange() < 0)
                .count();
        long faultRefunds = orderRepository.countFaultRefundsForUser(userId, OrderStatus.REFUNDED);
        long riskRecords = Math.max(negativeCreditRecords, faultRefunds);

        BigDecimal score = calculateCreditScore(effectiveOrders, fulfillmentRate, reviewCount, averageRating, riskRecords);
        return new CreditSnapshot(
                score,
                effectiveOrders,
                completedOrders,
                goodReviewRate,
                fulfillmentRate,
                riskRecords,
                reviewCount,
                averageRating
        );
    }

    private BigDecimal calculateCreditScore(long effectiveOrders,
                                            BigDecimal fulfillmentRate,
                                            long reviewCount,
                                            BigDecimal averageRating,
                                            long riskRecords) {
        if (effectiveOrders == 0 && reviewCount == 0) {
            return null;
        }

        double confidence = Math.min(1.0, effectiveOrders / 10.0);
        double reviewScore = averageRating == null ? 70.0 : averageRating.doubleValue() / 5.0 * 100.0;
        double fulfillmentScore = fulfillmentRate == null ? 70.0 : fulfillmentRate.doubleValue();
        double riskScore = Math.max(0.0, 100.0 - Math.min(30.0, riskRecords * 8.0));
        double behaviorScore = reviewScore * 0.45 + fulfillmentScore * 0.45 + riskScore * 0.10;
        double finalScore = 65.0 * (1.0 - confidence) + behaviorScore * confidence;

        return BigDecimal.valueOf(finalScore)
                .max(BigDecimal.ZERO)
                .min(new BigDecimal("100.00"))
                .setScale(1, RoundingMode.HALF_UP);
    }

    private BigDecimal percent(long numerator, long denominator) {
        if (denominator <= 0) {
            return null;
        }
        return BigDecimal.valueOf(numerator)
                .multiply(new BigDecimal("100"))
                .divide(BigDecimal.valueOf(denominator), 1, RoundingMode.HALF_UP);
    }

    private String resolveCreditLevel(BigDecimal score, long effectiveOrders, long reviewCount) {
        if (score == null) {
            return "新用户";
        }
        if (effectiveOrders < 3 && reviewCount < 3) {
            return "待积累";
        }
        if (score.compareTo(new BigDecimal("90")) >= 0) {
            return "信用优秀";
        }
        if (score.compareTo(new BigDecimal("75")) >= 0) {
            return "信用良好";
        }
        if (score.compareTo(new BigDecimal("60")) >= 0) {
            return "待提升";
        }
        return "信用较差";
    }

    private record CreditSnapshot(
            BigDecimal creditScore,
            long effectiveOrderCount,
            long completedOrderCount,
            BigDecimal goodReviewRate,
            BigDecimal fulfillmentRate,
            long riskRecordCount,
            long receivedReviewCount,
            BigDecimal averageRating
    ) {
    }
}
