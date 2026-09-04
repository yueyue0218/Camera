package com.action.camera.review.repository;

import com.action.camera.credit.repository.UserCountAggregate;
import com.action.camera.review.entity.ReviewComplaint;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ReviewComplaintRepository extends JpaRepository<ReviewComplaint, Long> {

    boolean existsByReviewIdAndComplainantIdAndStatusIn(Long reviewId, Long complainantId, List<String> statuses);

    List<ReviewComplaint> findByComplainantIdOrderByCreatedAtDesc(Long complainantId);

    List<ReviewComplaint> findByReviewIdOrderByCreatedAtDesc(Long reviewId);

    List<ReviewComplaint> findByStatusOrderByCreatedAtAsc(String status);

    List<ReviewComplaint> findAllByOrderByCreatedAtDesc();

    long countByStatusIn(List<String> statuses);

    long countByRespondentIdAndStatusAndArbitrationResult(Long respondentId, String status, String arbitrationResult);

    @Query("""
            select c.respondentId as userId, count(c) as aggregateCount
            from ReviewComplaint c
            where c.respondentId in :userIds
              and c.status = :status
              and c.arbitrationResult = :arbitrationResult
            group by c.respondentId
            """)
    List<UserCountAggregate> findResponsibleComplaintCounts(@Param("userIds") Collection<Long> userIds,
                                                              @Param("status") String status,
                                                              @Param("arbitrationResult") String arbitrationResult);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from ReviewComplaint c where c.id = :id")
    Optional<ReviewComplaint> findByIdForUpdate(@Param("id") Long id);
}
