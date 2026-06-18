package com.action.camera.credit.service;

import com.action.camera.dispute.repository.DisputeRepository;
import com.action.camera.order.entity.Order;
import com.action.camera.order.enums.OrderStatus;
import com.action.camera.order.repository.OrderRepository;
import com.action.camera.review.entity.Review;
import com.action.camera.review.repository.ReviewComplaintRepository;
import com.action.camera.review.repository.ReviewRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public class CreditSnapshotService {

    private static final String REVIEW_COMPLAINT_RESOLVED = "RESOLVED";
    private static final String REVIEW_COMPLAINT_RESPONSIBLE = "REVIEW_HIDDEN";

    private final OrderRepository orderRepository;
    private final ReviewRepository reviewRepository;
    private final ReviewComplaintRepository reviewComplaintRepository;
    private final DisputeRepository disputeRepository;

    public CreditSnapshotService(OrderRepository orderRepository,
                                 ReviewRepository reviewRepository,
                                 ReviewComplaintRepository reviewComplaintRepository,
                                 DisputeRepository disputeRepository) {
        this.orderRepository = orderRepository;
        this.reviewRepository = reviewRepository;
        this.reviewComplaintRepository = reviewComplaintRepository;
        this.disputeRepository = disputeRepository;
    }

    public CreditSnapshot getSnapshot(Long userId) {
        List<Review> reviews = reviewRepository.findByTargetUserIdAndIsVisibleTrueOrderByCreatedAtDesc(userId);
        Set<Long> effectiveOrderIds = reviews.stream()
                .map(Review::getOrderId)
                .filter(orderId -> orderId != null && orderId > 0)
                .collect(LinkedHashSet::new, Set::add, Set::addAll);
        long effectiveOrders = effectiveOrderIds.size();
        long completedOrders = effectiveOrderIds.isEmpty()
                ? 0
                : orderRepository.findAllById(effectiveOrderIds).stream()
                .map(Order::getStatus)
                .filter(OrderStatus.COMPLETED::equals)
                .count();

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

        long reviewComplaintRisks = reviewComplaintRepository.countByRespondentIdAndStatusAndArbitrationResult(
                userId,
                REVIEW_COMPLAINT_RESOLVED,
                REVIEW_COMPLAINT_RESPONSIBLE
        );
        long disputeRisks = disputeRepository.countResponsibleResolvedDisputesForUser(userId);
        long riskRecords = reviewComplaintRisks + disputeRisks;
        BigDecimal defaultRate = effectiveOrders == 0 ? null : percentCapped(riskRecords, effectiveOrders);

        BigDecimal score = calculateCreditScore(effectiveOrders, reviewCount, averageRating, defaultRate);
        return new CreditSnapshot(
                score,
                effectiveOrders,
                completedOrders,
                goodReviewRate,
                defaultRate,
                riskRecords,
                reviewCount,
                averageRating
        );
    }

    public BigDecimal getDisplayCreditScore(Long userId) {
        return getSnapshot(userId).creditScore();
    }

    public String resolveCreditLevel(CreditSnapshot snapshot) {
        return resolveCreditLevel(snapshot.creditScore(), snapshot.effectiveOrderCount(), snapshot.receivedReviewCount());
    }

    public String resolveCreditLevel(BigDecimal score, long effectiveOrders, long reviewCount) {
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

    private BigDecimal calculateCreditScore(long effectiveOrders,
                                            long reviewCount,
                                            BigDecimal averageRating,
                                            BigDecimal defaultRate) {
        if (effectiveOrders == 0 && reviewCount == 0) {
            return null;
        }

        double confidence = Math.min(1.0, effectiveOrders / 10.0);
        double reviewScore = averageRating == null ? 70.0 : averageRating.doubleValue() / 5.0 * 100.0;
        double trustScore = defaultRate == null ? 100.0 : Math.max(0.0, 100.0 - defaultRate.doubleValue());
        double behaviorScore = reviewScore * 0.65 + trustScore * 0.35;
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

    private BigDecimal percentCapped(long numerator, long denominator) {
        BigDecimal value = percent(numerator, denominator);
        if (value == null) {
            return null;
        }
        return value.min(new BigDecimal("100.0"));
    }

    public record CreditSnapshot(
            BigDecimal creditScore,
            long effectiveOrderCount,
            long completedOrderCount,
            BigDecimal goodReviewRate,
            BigDecimal defaultRate,
            long riskRecordCount,
            long receivedReviewCount,
            BigDecimal averageRating
    ) {
    }
}
