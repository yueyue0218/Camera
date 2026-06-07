package com.action.camera.order.entity;

import com.action.camera.order.converter.CentToYuanConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * P4 simulated payment record. The only supported method is MOCK_PAY.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "payment_records")
public class PaymentRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "payment_no", nullable = false, length = 40)
    private String paymentNo;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Transient
    private Long payerId;

    @Column(name = "third_party_trade_no", length = 80)
    private String thirdPartyTradeNo;

    @Column(name = "amount", nullable = false, precision = 10, scale = 2)
    @Convert(converter = CentToYuanConverter.class)
    private Long amountCent;

    @Column(name = "refund_amount", nullable = false, precision = 10, scale = 2)
    @Convert(converter = CentToYuanConverter.class)
    private Long refundAmountCent = 0L;

    @Column(name = "pay_method", nullable = false, length = 30)
    private String payMethod;

    @Column(name = "status", nullable = false, length = 30)
    private String status;

    @Column(name = "requested_at", nullable = false)
    private LocalDateTime requestedAt;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @Column(name = "refunded_at")
    private LocalDateTime refundedAt;

    @Transient
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (requestedAt == null) {
            requestedAt = LocalDateTime.now();
        }
        if (refundAmountCent == null) {
            refundAmountCent = 0L;
        }
        if (createdAt == null) {
            createdAt = requestedAt;
        }
    }
}
