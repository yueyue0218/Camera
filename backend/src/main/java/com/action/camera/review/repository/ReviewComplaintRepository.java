package com.action.camera.review.repository;

import com.action.camera.review.entity.ReviewComplaint;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReviewComplaintRepository extends JpaRepository<ReviewComplaint, Long> {

    boolean existsByReviewIdAndComplainantIdAndStatusIn(Long reviewId, Long complainantId, List<String> statuses);

    List<ReviewComplaint> findByComplainantIdOrderByCreatedAtDesc(Long complainantId);

    List<ReviewComplaint> findByReviewIdOrderByCreatedAtDesc(Long reviewId);

    List<ReviewComplaint> findByStatusOrderByCreatedAtAsc(String status);

    List<ReviewComplaint> findAllByOrderByCreatedAtDesc();

    long countByStatusIn(List<String> statuses);
}
