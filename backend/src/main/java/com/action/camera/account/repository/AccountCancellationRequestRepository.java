package com.action.camera.account.repository;

import com.action.camera.account.domain.AccountCancellationRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import jakarta.persistence.LockModeType;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface AccountCancellationRequestRepository
        extends JpaRepository<AccountCancellationRequest, Long> {

    Optional<AccountCancellationRequest> findByUserId(Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select request from AccountCancellationRequest request where request.userId = :userId")
    Optional<AccountCancellationRequest> findByUserIdForUpdate(@Param("userId") Long userId);

    Page<AccountCancellationRequest> findAllByOrderByRequestedAtDesc(Pageable pageable);

    Page<AccountCancellationRequest> findAllByStatusOrderByRequestedAtDesc(
            com.action.camera.account.domain.AccountCancellationStatus status, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select request from AccountCancellationRequest request where request.id = :id")
    Optional<AccountCancellationRequest> findByIdForUpdate(@Param("id") Long id);
}
