package com.action.camera.order.repository;

import com.action.camera.order.entity.PaymentRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;


public interface PaymentRecordRepository extends JpaRepository<PaymentRecord, Long> {

    Optional<PaymentRecord> findByOrderId(Long orderId);

    @Query(value = """
            select coalesce(sum(amount), 0)
            from payment_records
            where status in ('PAID', 'SUCCESS')
              and paid_at >= :start
              and paid_at < :end
            """, nativeQuery = true)
    Optional<BigDecimal> sumPaidAmountYuanBetween(@Param("start") LocalDateTime start,
                                                  @Param("end") LocalDateTime end);
}
