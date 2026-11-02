package com.action.camera.auth.repository;

import com.action.camera.auth.domain.SmsChallenge;
import com.action.camera.auth.domain.SmsPurpose;
import com.action.camera.auth.domain.SmsDeliveryStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.Collection;

public interface SmsChallengeRepository extends JpaRepository<SmsChallenge, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<SmsChallenge> findFirstByPhoneHashAndPurposeOrderByCreatedAtDesc(String phoneHash, SmsPurpose purpose);

    long countByPhoneHashAndCreatedAtAfter(String phoneHash, LocalDateTime createdAfter);

    long countByRequestIpAndCreatedAtAfter(String requestIp, LocalDateTime createdAfter);

    long countByDeviceIdAndCreatedAtAfter(String deviceId, LocalDateTime createdAfter);

    long countByPhoneHashAndDeliveryStatusInAndCreatedAtAfter(String phoneHash,
            Collection<SmsDeliveryStatus> statuses, LocalDateTime createdAfter);

    long countByRequestIpAndDeliveryStatusInAndCreatedAtAfter(String requestIp,
            Collection<SmsDeliveryStatus> statuses, LocalDateTime createdAfter);

    long countByDeviceIdAndDeliveryStatusInAndCreatedAtAfter(String deviceId,
            Collection<SmsDeliveryStatus> statuses, LocalDateTime createdAfter);

    boolean existsByPhoneHashAndPurposeAndDeliveryStatusInAndCreatedAtAfter(String phoneHash,
            SmsPurpose purpose, Collection<SmsDeliveryStatus> statuses, LocalDateTime createdAfter);

    long deleteByExpiresAtBefore(LocalDateTime cutoff);
}
