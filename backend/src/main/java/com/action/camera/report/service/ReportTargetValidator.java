package com.action.camera.report.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.common.security.UserRole;
import com.action.camera.demand.domain.Demand;
import com.action.camera.demand.repository.DemandRepository;
import com.action.camera.demand.service.DemandService;
import com.action.camera.report.domain.ReportTargetType;
import com.action.camera.repository.UserRepository;
import com.action.camera.review.entity.Review;
import com.action.camera.review.repository.ReviewRepository;
import com.action.camera.servicepackage.domain.ServicePackage;
import com.action.camera.servicepackage.repository.ServicePackageRepository;
import com.action.camera.servicepackage.service.ServicePackageService;
import com.action.camera.social.domain.MomentPost;
import com.action.camera.social.repository.MomentPostRepository;
import com.action.camera.social.service.MomentService;
import org.springframework.stereotype.Service;

@Service
public class ReportTargetValidator {
    private final UserRepository userRepository;
    private final DemandRepository demandRepository;
    private final DemandService demandService;
    private final ServicePackageRepository servicePackageRepository;
    private final ServicePackageService servicePackageService;
    private final MomentPostRepository momentPostRepository;
    private final MomentService momentService;
    private final ReviewRepository reviewRepository;

    public ReportTargetValidator(UserRepository userRepository,
                                 DemandRepository demandRepository,
                                 DemandService demandService,
                                 ServicePackageRepository servicePackageRepository,
                                 ServicePackageService servicePackageService,
                                 MomentPostRepository momentPostRepository,
                                 MomentService momentService,
                                 ReviewRepository reviewRepository) {
        this.userRepository = userRepository;
        this.demandRepository = demandRepository;
        this.demandService = demandService;
        this.servicePackageRepository = servicePackageRepository;
        this.servicePackageService = servicePackageService;
        this.momentPostRepository = momentPostRepository;
        this.momentService = momentService;
        this.reviewRepository = reviewRepository;
    }

    public void validateReportable(ReportTargetType targetType, Long targetId, Long reporterId) {
        if (targetType == null || targetId == null || targetId <= 0 || reporterId == null || reporterId <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Report target is invalid");
        }
        CurrentUser currentUser = currentUser(reporterId);
        switch (targetType) {
            case USER -> validateUser(targetId, reporterId);
            case DEMAND -> {
                demandService.getDemand(targetId, currentUser);
                Demand demand = demandRepository.findById(targetId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Demand not found"));
                rejectOwn(demand.getCustomerId(), reporterId);
            }
            case SERVICE_PACKAGE -> {
                servicePackageService.getServiceDetail(targetId, currentUser);
                ServicePackage servicePackage = servicePackageRepository.findById(targetId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Service package not found"));
                rejectOwn(servicePackage.getProviderId(), reporterId);
            }
            case MOMENT -> {
                momentService.getMoment(targetId, currentUser);
                MomentPost moment = momentPostRepository.findById(targetId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Moment not found"));
                rejectOwn(moment.getAuthorId(), reporterId);
            }
            case REVIEW -> {
                Review review = reviewRepository.findById(targetId)
                        .filter(item -> Boolean.TRUE.equals(item.getIsVisible()))
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Review not found"));
                rejectOwn(review.getReviewerId(), reporterId);
            }
        }
    }

    private void validateUser(Long targetId, Long reporterId) {
        if (!userRepository.existsById(targetId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "User not found");
        }
        rejectOwn(targetId, reporterId);
    }

    private void rejectOwn(Long ownerId, Long reporterId) {
        if (reporterId.equals(ownerId)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Users cannot report themselves or their own content");
        }
    }

    private CurrentUser currentUser(Long reporterId) {
        UserRole role = UserContext.getCurrentRole();
        if (role == null) {
            role = UserRole.CUSTOMER;
        }
        return new CurrentUser(reporterId, role, UserContext.isAdmin());
    }
}
