package com.action.camera.review.repository;

import com.action.camera.credit.repository.CreditReviewAggregate;
import com.action.camera.review.entity.Review;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ReviewRepository extends JpaRepository<Review, Long> {

    Optional<Review> findByOrderIdAndDirection(Long orderId, String direction);

    List<Review> findByOrderIdOrderByCreatedAtDesc(Long orderId);

    List<Review> findByTargetUserIdAndIsVisibleTrueOrderByCreatedAtDesc(Long targetUserId);

    @Query("""
            select r.targetUserId as userId,
                   count(r) as reviewCount,
                   sum(case when r.rating >= 4 then 1 else 0 end) as goodReviewCount,
                   avg(r.rating) as averageRating,
                   count(distinct r.orderId) as effectiveOrderCount
            from Review r
            where r.targetUserId in :userIds
              and r.isVisible = true
            group by r.targetUserId
            """)
    List<CreditReviewAggregate> findCreditAggregates(@Param("userIds") Collection<Long> userIds);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Review r where r.id = :id")
    Optional<Review> findByIdForUpdate(@Param("id") Long id);
}
