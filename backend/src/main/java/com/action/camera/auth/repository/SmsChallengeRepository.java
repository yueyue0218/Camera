package com.action.camera.auth.repository;

import com.action.camera.auth.domain.SmsChallenge;
import com.action.camera.auth.domain.SmsPurpose;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.time.LocalDateTime;
import java.util.Optional;

public interface SmsChallengeRepository extends JpaRepository<SmsChallenge, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<SmsChallenge> findFirstByPhoneHashAndPurposeOrderByCreatedAtDesc(String phoneHash, SmsPurpose purpose);

    long countByPhoneHashAndCreatedAtAfter(String phoneHash, LocalDateTime createdAfter);

    long countByRequestIpAndCreatedAtAfter(String requestIp, LocalDateTime createdAfter);

    long countByDeviceIdAndCreatedAtAfter(String deviceId, LocalDateTime createdAfter);

    long deleteByExpiresAtBefore(LocalDateTime cutoff);
}
