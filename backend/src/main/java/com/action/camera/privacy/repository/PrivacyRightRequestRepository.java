package com.action.camera.privacy.repository;
import com.action.camera.privacy.domain.PrivacyRightRequest;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.*;
import jakarta.persistence.LockModeType;
import java.util.Optional;
public interface PrivacyRightRequestRepository extends JpaRepository<PrivacyRightRequest, Long> {
    Optional<PrivacyRightRequest> findByUserIdAndIdempotencyKey(Long userId, String key);
    Page<PrivacyRightRequest> findByUserIdOrderBySubmittedAtDescIdDesc(Long userId, Pageable pageable);
    Page<PrivacyRightRequest> findAllByOrderBySubmittedAtDescIdDesc(Pageable pageable);
    Page<PrivacyRightRequest> findByStatusOrderBySubmittedAtDescIdDesc(String status, Pageable pageable);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select r from PrivacyRightRequest r where r.id=:id")
    Optional<PrivacyRightRequest> findByIdForUpdate(@Param("id") Long id);
}
