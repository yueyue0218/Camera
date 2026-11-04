package com.action.camera.photoauthorization.repository;

import com.action.camera.photoauthorization.entity.PhotoAuthorization;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PhotoAuthorizationRepository extends JpaRepository<PhotoAuthorization, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from PhotoAuthorization a where a.id = :id")
    Optional<PhotoAuthorization> findByIdForUpdate(@Param("id") Long id);

    List<PhotoAuthorization> findByOrderIdOrderByAuthorizedAtDesc(Long orderId);

    List<PhotoAuthorization> findByProviderUserIdAndStatusOrderByAuthorizedAtDesc(
            Long providerUserId,
            String status
    );
}
