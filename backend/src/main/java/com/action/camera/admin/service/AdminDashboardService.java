package com.action.camera.admin.service;

import com.action.camera.admin.dto.AdminDashboardResponse;
import com.action.camera.admin.repository.RealNameCertificationRepository;
import com.action.camera.admin.repository.StudentCertificationRepository;
import com.action.camera.order.repository.PaymentRecordRepository;
import com.action.camera.repository.UserRepository;
import com.action.camera.review.repository.ReviewComplaintRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class AdminDashboardService {

    private static final String PENDING_REVIEW = "PENDING_REVIEW";

    private final AdminPermissionService permissionService;
    private final UserRepository userRepository;
    private final PaymentRecordRepository paymentRecordRepository;
    private final RealNameCertificationRepository realNameCertificationRepository;
    private final StudentCertificationRepository studentCertificationRepository;
    private final ReviewComplaintRepository reviewComplaintRepository;

    public AdminDashboardService(AdminPermissionService permissionService,
                                 UserRepository userRepository,
                                 PaymentRecordRepository paymentRecordRepository,
                                 RealNameCertificationRepository realNameCertificationRepository,
                                 StudentCertificationRepository studentCertificationRepository,
                                 ReviewComplaintRepository reviewComplaintRepository) {
        this.permissionService = permissionService;
        this.userRepository = userRepository;
        this.paymentRecordRepository = paymentRecordRepository;
        this.realNameCertificationRepository = realNameCertificationRepository;
        this.studentCertificationRepository = studentCertificationRepository;
        this.reviewComplaintRepository = reviewComplaintRepository;
    }

    @Transactional(readOnly = true)
    public AdminDashboardResponse getDashboard() {
        permissionService.requireAdmin();
        LocalDateTime start = LocalDate.now().atStartOfDay();
        LocalDateTime end = start.plusDays(1);
        long todayGmvCent = toCent(paymentRecordRepository.sumPaidAmountYuanBetween(start, end).orElse(BigDecimal.ZERO));
        long pendingAuditCount = realNameCertificationRepository.countByStatus(PENDING_REVIEW)
                + studentCertificationRepository.countByStatus(PENDING_REVIEW);
        long pendingArbitrationCount = reviewComplaintRepository.countByStatusIn(List.of("PENDING", "PROCESSING"));
        return new AdminDashboardResponse(
                userRepository.count(),
                todayGmvCent,
                pendingAuditCount,
                pendingArbitrationCount
        );
    }

    private long toCent(BigDecimal amountYuan) {
        return amountYuan
                .multiply(BigDecimal.valueOf(100))
                .setScale(0, RoundingMode.UNNECESSARY)
                .longValueExact();
    }
}
