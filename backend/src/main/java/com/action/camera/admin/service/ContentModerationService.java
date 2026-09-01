package com.action.camera.admin.service;

import com.action.camera.admin.dto.AdminHallItemResponse;
import com.action.camera.admin.dto.AdminHallItemType;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.demand.domain.Demand;
import com.action.camera.demand.repository.DemandRepository;
import com.action.camera.servicepackage.domain.ServicePackage;
import com.action.camera.servicepackage.repository.ServicePackageRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class ContentModerationService {

    private final AdminPermissionService adminPermissionService;
    private final AdminAuditService adminAuditService;
    private final AdminHallService adminHallService;
    private final DemandRepository demandRepository;
    private final ServicePackageRepository servicePackageRepository;

    public ContentModerationService(AdminPermissionService adminPermissionService,
                                    AdminAuditService adminAuditService,
                                    AdminHallService adminHallService,
                                    DemandRepository demandRepository,
                                    ServicePackageRepository servicePackageRepository) {
        this.adminPermissionService = adminPermissionService;
        this.adminAuditService = adminAuditService;
        this.adminHallService = adminHallService;
        this.demandRepository = demandRepository;
        this.servicePackageRepository = servicePackageRepository;
    }

    @Transactional
    public AdminHallItemResponse takeDownHallItem(AdminHallItemType type, Long id, String reason) {
        return changeVisibility(type, id, reason, false);
    }

    @Transactional
    public AdminHallItemResponse restoreHallItem(AdminHallItemType type, Long id, String reason) {
        return changeVisibility(type, id, reason, true);
    }

    private AdminHallItemResponse changeVisibility(AdminHallItemType type,
                                                   Long id,
                                                   String reason,
                                                   boolean restore) {
        Long adminId = adminPermissionService.requireAdmin();
        if (type == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Hall item type is required");
        }
        type.requireConcrete();
        if (id == null || id <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Hall item id must be positive");
        }
        String normalizedReason = normalizeReason(reason);
        LocalDateTime now = LocalDateTime.now();

        return switch (type) {
            case DEMAND -> changeDemand(id, adminId, normalizedReason, now, restore);
            case SERVICE_PACKAGE -> changeServicePackage(id, adminId, normalizedReason, now, restore);
            case ALL -> throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Hall item type must be concrete");
        };
    }

    private AdminHallItemResponse changeDemand(Long id,
                                               Long adminId,
                                               String reason,
                                               LocalDateTime now,
                                               boolean restore) {
        Demand demand = demandRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Demand not found: " + id));
        if (restore) {
            demand.restore(adminId, reason, now);
        } else {
            demand.takeDown(adminId, reason, now);
        }
        demandRepository.save(demand);
        adminAuditService.record("DEMAND", id, adminId, restore ? "RESTORE" : "TAKE_DOWN", reason);
        return adminHallService.toResponse(demand);
    }

    private AdminHallItemResponse changeServicePackage(Long id,
                                                       Long adminId,
                                                       String reason,
                                                       LocalDateTime now,
                                                       boolean restore) {
        ServicePackage servicePackage = servicePackageRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new BusinessException(
                        ErrorCode.NOT_FOUND, "Service package not found: " + id));
        if (restore) {
            servicePackage.restore(adminId, reason, now);
        } else {
            servicePackage.takeDown(adminId, reason, now);
        }
        servicePackageRepository.save(servicePackage);
        adminAuditService.record(
                "SERVICE_PACKAGE", id, adminId, restore ? "RESTORE" : "TAKE_DOWN", reason);
        return adminHallService.toResponse(servicePackage);
    }

    private String normalizeReason(String reason) {
        if (reason == null || reason.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Moderation reason is required");
        }
        String normalized = reason.trim();
        if (normalized.length() > 500) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Moderation reason is too long");
        }
        return normalized;
    }
}
