package com.action.camera.admin.service;

import com.action.camera.admin.dto.AdminDashboardResponse;
import com.action.camera.admin.domain.ModerationStatus;
import com.action.camera.admin.repository.RealNameCertificationRepository;
import com.action.camera.admin.repository.StudentCertificationRepository;
import com.action.camera.certification.enums.CertificationStatus;
import com.action.camera.demand.repository.DemandRepository;
import com.action.camera.order.repository.PaymentRecordRepository;
import com.action.camera.report.domain.ReportStatus;
import com.action.camera.report.repository.ReportRepository;
import com.action.camera.repository.UserRepository;
import com.action.camera.review.repository.ReviewComplaintRepository;
import com.action.camera.servicepackage.repository.ServicePackageRepository;
import com.action.camera.social.repository.MomentPostRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class AdminDashboardService {

    private static final String REAL_NAME_PENDING = CertificationStatus.PENDING.name();
    private static final String STUDENT_PENDING = "PENDING_REVIEW";

    private final AdminPermissionService permissionService;
    private final UserRepository userRepository;
    private final PaymentRecordRepository paymentRecordRepository;
    private final RealNameCertificationRepository realNameCertificationRepository;
    private final StudentCertificationRepository studentCertificationRepository;
    private final ReviewComplaintRepository reviewComplaintRepository;
    private final ReportRepository reportRepository;
    private final DemandRepository demandRepository;
    private final ServicePackageRepository servicePackageRepository;
    private final MomentPostRepository momentPostRepository;

    public AdminDashboardService(AdminPermissionService permissionService,
                                 UserRepository userRepository,
                                 PaymentRecordRepository paymentRecordRepository,
                                 RealNameCertificationRepository realNameCertificationRepository,
                                 StudentCertificationRepository studentCertificationRepository,
                                 ReviewComplaintRepository reviewComplaintRepository,
                                 ReportRepository reportRepository,
                                 DemandRepository demandRepository,
                                 ServicePackageRepository servicePackageRepository,
                                 MomentPostRepository momentPostRepository) {
        this.permissionService = permissionService;
        this.userRepository = userRepository;
        this.paymentRecordRepository = paymentRecordRepository;
        this.realNameCertificationRepository = realNameCertificationRepository;
        this.studentCertificationRepository = studentCertificationRepository;
        this.reviewComplaintRepository = reviewComplaintRepository;
        this.reportRepository = reportRepository;
        this.demandRepository = demandRepository;
        this.servicePackageRepository = servicePackageRepository;
        this.momentPostRepository = momentPostRepository;
    }

    @Transactional(readOnly = true)
    public AdminDashboardResponse getDashboard() {
        permissionService.requireAdmin();
        LocalDateTime start = LocalDate.now().atStartOfDay();
        LocalDateTime end = start.plusDays(1);
        long todayGmvCent = toCent(paymentRecordRepository.sumPaidAmountYuanBetween(start, end).orElse(BigDecimal.ZERO));
        long pendingAuditCount = realNameCertificationRepository.countByStatus(REAL_NAME_PENDING)
                + studentCertificationRepository.countByStatus(STUDENT_PENDING);
        long pendingArbitrationCount = reviewComplaintRepository.countByStatusIn(List.of("PENDING", "PROCESSING"));
        long pendingReportCount = reportRepository.countByStatus(ReportStatus.PENDING);
        long removedContentCount = demandRepository.countByModerationStatus(ModerationStatus.HIDDEN)
                + servicePackageRepository.countByModerationStatus(ModerationStatus.HIDDEN)
                + momentPostRepository.countByModerationStatus(ModerationStatus.HIDDEN);
        return new AdminDashboardResponse(
                userRepository.count(),
                todayGmvCent,
                pendingAuditCount,
                pendingArbitrationCount,
                pendingReportCount,
                removedContentCount
        );
    }

    private long toCent(BigDecimal amountYuan) {
        return amountYuan
                .multiply(BigDecimal.valueOf(100))
                .setScale(0, RoundingMode.UNNECESSARY)
                .longValueExact();
    }
}
