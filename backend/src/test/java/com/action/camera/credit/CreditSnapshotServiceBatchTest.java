package com.action.camera.credit;

import com.action.camera.credit.repository.CreditReviewAggregate;
import com.action.camera.credit.repository.UserCountAggregate;
import com.action.camera.credit.service.CreditSnapshotService;
import com.action.camera.dispute.repository.DisputeRepository;
import com.action.camera.order.enums.OrderStatus;
import com.action.camera.order.repository.OrderRepository;
import com.action.camera.review.repository.ReviewComplaintRepository;
import com.action.camera.review.repository.ReviewRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CreditSnapshotServiceBatchTest {

    @Test
    void batchSnapshotPreservesFormulaAndUsesOneAggregateQueryPerSource() {
        OrderRepository orders = mock(OrderRepository.class);
        ReviewRepository reviews = mock(ReviewRepository.class);
        ReviewComplaintRepository complaints = mock(ReviewComplaintRepository.class);
        DisputeRepository disputes = mock(DisputeRepository.class);
        List<Long> userIds = List.of(11L, 12L);
        Collection<Long> normalizedIds = new LinkedHashSet<>(userIds);
        CreditReviewAggregate reviewAggregate = reviewAggregate(11L, 4L, 3L, 4.5, 3L);
        UserCountAggregate completedOrderAggregate = countAggregate(11L, 2L);
        UserCountAggregate complaintAggregate = countAggregate(11L, 1L);
        UserCountAggregate disputeAggregate = countAggregate(11L, 2L);

        when(reviews.findCreditAggregates(normalizedIds)).thenReturn(List.of(reviewAggregate));
        when(orders.findCompletedReviewedOrderCounts(normalizedIds, OrderStatus.COMPLETED))
                .thenReturn(List.of(completedOrderAggregate));
        when(complaints.findResponsibleComplaintCounts(normalizedIds, "RESOLVED", "REVIEW_HIDDEN"))
                .thenReturn(List.of(complaintAggregate));
        when(disputes.findResponsibleResolvedDisputeCounts(normalizedIds))
                .thenReturn(List.of(disputeAggregate));

        CreditSnapshotService service = new CreditSnapshotService(orders, reviews, complaints, disputes);
        Map<Long, CreditSnapshotService.CreditSnapshot> snapshots = service.getSnapshots(userIds);

        assertThat(snapshots).containsOnlyKeys(11L, 12L);
        assertThat(snapshots.get(11L)).isEqualTo(new CreditSnapshotService.CreditSnapshot(
                new BigDecimal("63.1"),
                3L,
                2L,
                new BigDecimal("75.0"),
                new BigDecimal("100.0"),
                3L,
                4L,
                new BigDecimal("4.5")
        ));
        assertThat(snapshots.get(12L)).isEqualTo(new CreditSnapshotService.CreditSnapshot(
                null, 0L, 0L, null, null, 0L, 0L, null));

        verify(reviews).findCreditAggregates(normalizedIds);
        verify(orders).findCompletedReviewedOrderCounts(normalizedIds, OrderStatus.COMPLETED);
        verify(complaints).findResponsibleComplaintCounts(normalizedIds, "RESOLVED", "REVIEW_HIDDEN");
        verify(disputes).findResponsibleResolvedDisputeCounts(normalizedIds);
        verify(reviews, never()).findByTargetUserIdAndIsVisibleTrueOrderByCreatedAtDesc(11L);
        verify(complaints, never()).countByRespondentIdAndStatusAndArbitrationResult(11L, "RESOLVED", "REVIEW_HIDDEN");
        verify(disputes, never()).countResponsibleResolvedDisputesForUser(11L);
    }

    @Test
    void displayScoresKeepInputOrderAndNullForNewUser() {
        OrderRepository orders = mock(OrderRepository.class);
        ReviewRepository reviews = mock(ReviewRepository.class);
        ReviewComplaintRepository complaints = mock(ReviewComplaintRepository.class);
        DisputeRepository disputes = mock(DisputeRepository.class);
        List<Long> userIds = List.of(12L, 11L, 12L);
        Collection<Long> normalizedIds = new LinkedHashSet<>(userIds);
        CreditReviewAggregate reviewAggregate = reviewAggregate(11L, 1L, 1L, 5.0, 1L);

        when(reviews.findCreditAggregates(normalizedIds)).thenReturn(List.of(reviewAggregate));
        when(orders.findCompletedReviewedOrderCounts(normalizedIds, OrderStatus.COMPLETED)).thenReturn(List.of());
        when(complaints.findResponsibleComplaintCounts(normalizedIds, "RESOLVED", "REVIEW_HIDDEN")).thenReturn(List.of());
        when(disputes.findResponsibleResolvedDisputeCounts(normalizedIds)).thenReturn(List.of());

        CreditSnapshotService service = new CreditSnapshotService(orders, reviews, complaints, disputes);
        Map<Long, BigDecimal> scores = service.getDisplayCreditScores(userIds);

        assertThat(scores.keySet()).containsExactly(12L, 11L);
        assertThat(scores.get(12L)).isNull();
        assertThat(scores.get(11L)).isEqualByComparingTo("68.5");
    }

    private CreditReviewAggregate reviewAggregate(Long userId,
                                                   Long reviewCount,
                                                   Long goodReviewCount,
                                                   Double averageRating,
                                                   Long effectiveOrderCount) {
        CreditReviewAggregate aggregate = mock(CreditReviewAggregate.class);
        when(aggregate.getUserId()).thenReturn(userId);
        when(aggregate.getReviewCount()).thenReturn(reviewCount);
        when(aggregate.getGoodReviewCount()).thenReturn(goodReviewCount);
        when(aggregate.getAverageRating()).thenReturn(averageRating);
        when(aggregate.getEffectiveOrderCount()).thenReturn(effectiveOrderCount);
        return aggregate;
    }

    private UserCountAggregate countAggregate(Long userId, Long count) {
        UserCountAggregate aggregate = mock(UserCountAggregate.class);
        when(aggregate.getUserId()).thenReturn(userId);
        when(aggregate.getAggregateCount()).thenReturn(count);
        return aggregate;
    }
}
