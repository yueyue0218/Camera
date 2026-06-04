package com.action.camera.repository;

import com.action.camera.domain.CreditRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CreditRecordRepository extends JpaRepository<CreditRecord, Long> {

    List<CreditRecord> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<CreditRecord> findBySourceTypeAndSourceId(String sourceType, Long sourceId);
}
