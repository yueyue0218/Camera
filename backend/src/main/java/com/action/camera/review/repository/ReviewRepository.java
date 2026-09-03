package com.action.camera.review.repository;

import com.action.camera.review.entity.Review;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ReviewRepository extends JpaRepository<Review, Long> {

    Optional<Review> findByOrderIdAndDirection(Long orderId, String direction);

    List<Review> findByOrderIdOrderByCreatedAtDesc(Long orderId);

    List<Review> findByTargetUserIdAndIsVisibleTrueOrderByCreatedAtDesc(Long targetUserId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Review r where r.id = :id")
    Optional<Review> findByIdForUpdate(@Param("id") Long id);
}
