package com.action.camera.photoauthorization.repository;

import com.action.camera.photoauthorization.entity.PhotoAuthorization;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PhotoAuthorizationRepository extends JpaRepository<PhotoAuthorization, Long> {

    List<PhotoAuthorization> findByOrderIdOrderByAuthorizedAtDesc(Long orderId);

    List<PhotoAuthorization> findByProviderUserIdAndStatusOrderByAuthorizedAtDesc(
            Long providerUserId,
            String status
    );
}
