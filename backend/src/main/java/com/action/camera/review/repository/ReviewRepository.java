package com.action.camera.review.repository;

import com.action.camera.review.entity.Review;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ReviewRepository extends JpaRepository<Review, Long> {

    Optional<Review> findByOrderIdAndDirection(Long orderId, String direction);

    List<Review> findByOrderIdOrderByCreatedAtDesc(Long orderId);

    List<Review> findByTargetUserIdOrderByCreatedAtDesc(Long targetUserId);
}
