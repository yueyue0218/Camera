package com.action.camera.credit.repository;

import com.action.camera.credit.entity.CreditRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CreditRecordRepository extends JpaRepository<CreditRecord, Long> {

    List<CreditRecord> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<CreditRecord> findFirstByUserIdOrderByCreatedAtDescIdDesc(Long userId);

    long countByUserId(Long userId);
}
