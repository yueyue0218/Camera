package com.action.camera.repository;

import com.action.camera.domain.CreditRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CreditRecordRepository extends JpaRepository<CreditRecord, Long> {

    List<CreditRecord> findByUserIdOrderByCreatedAtDesc(Long userId);
}