package com.action.camera.auth.repository;

import com.action.camera.auth.domain.UserSession;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface UserSessionRepository extends JpaRepository<UserSession, Long> {

    Optional<UserSession> findBySessionId(String sessionId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<UserSession> findBySessionIdAndUserId(String sessionId, Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<UserSession> findByRefreshTokenHash(String refreshTokenHash);

    boolean existsBySessionIdAndUserIdAndRevokedAtIsNullAndExpiresAtAfter(
            String sessionId,
            Long userId,
            LocalDateTime now);

    List<UserSession> findAllByUserIdAndRevokedAtIsNullAndExpiresAtAfterOrderByCreatedAtDesc(
            Long userId,
            LocalDateTime now);

    long deleteByExpiresAtBefore(LocalDateTime cutoff);
}
