package com.action.camera.admin.service;

import com.action.camera.admin.dto.AdminHallItemResponse;
import com.action.camera.admin.dto.AdminHallItemType;
import com.action.camera.admin.dto.AdminModerationFilter;
import com.action.camera.admin.repository.AdminHallQueryRepository;
import com.action.camera.admin.repository.AdminHallQueryRepository.HallItemId;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.page.PageResult;
import com.action.camera.demand.domain.Demand;
import com.action.camera.demand.repository.DemandRepository;
import com.action.camera.report.domain.ReportStatus;
import com.action.camera.report.domain.ReportTargetType;
import com.action.camera.report.repository.ReportRepository;
import com.action.camera.servicepackage.domain.ServicePackage;
import com.action.camera.servicepackage.repository.ServicePackageRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class AdminHallService {

    private final AdminPermissionService adminPermissionService;
    private final AdminHallQueryRepository adminHallQueryRepository;
    private final DemandRepository demandRepository;
    private final ServicePackageRepository servicePackageRepository;
    private final ReportRepository reportRepository;

    public AdminHallService(AdminPermissionService adminPermissionService,
                            AdminHallQueryRepository adminHallQueryRepository,
                            DemandRepository demandRepository,
                            ServicePackageRepository servicePackageRepository,
                            ReportRepository reportRepository) {
        this.adminPermissionService = adminPermissionService;
        this.adminHallQueryRepository = adminHallQueryRepository;
        this.demandRepository = demandRepository;
        this.servicePackageRepository = servicePackageRepository;
        this.reportRepository = reportRepository;
    }

    @Transactional(readOnly = true)
    public PageResult<AdminHallItemResponse> list(AdminHallItemType type,
                                                   AdminModerationFilter status,
                                                   String keyword,
                                                   int page,
                                                   int size) {
        adminPermissionService.requireAdmin();
        AdminHallItemType safeType = type == null ? AdminHallItemType.ALL : type;
        AdminModerationFilter safeStatus = status == null ? AdminModerationFilter.ALL : status;
        validatePage(page, size);
        String normalizedKeyword = normalizeKeyword(keyword);
        AdminHallQueryRepository.HallIdPage idPage = adminHallQueryRepository.findPage(
                safeType, safeStatus, normalizedKeyword, size, (page - 1) * size);

        Map<Long, Demand> demands = loadDemands(idPage.records());
        Map<Long, ServicePackage> services = loadServices(idPage.records());
        List<AdminHallItemResponse> records = new ArrayList<>(idPage.records().size());
        for (HallItemId item : idPage.records()) {
            if (item.type() == AdminHallItemType.DEMAND) {
                Demand demand = demands.get(item.id());
                if (demand != null) {
                    records.add(toResponse(demand));
                }
            } else if (item.type() == AdminHallItemType.SERVICE_PACKAGE) {
                ServicePackage servicePackage = services.get(item.id());
                if (servicePackage != null) {
                    records.add(toResponse(servicePackage));
                }
            }
        }
        return new PageResult<>(records, page, size, idPage.total());
    }

    AdminHallItemResponse toResponse(Demand demand) {
        long pendingReports = reportRepository.countByTargetTypeAndTargetIdAndStatus(
                ReportTargetType.DEMAND, demand.getId(), ReportStatus.PENDING);
        return AdminHallItemResponse.fromDemand(demand, pendingReports);
    }

    AdminHallItemResponse toResponse(ServicePackage servicePackage) {
        long pendingReports = reportRepository.countByTargetTypeAndTargetIdAndStatus(
                ReportTargetType.SERVICE_PACKAGE, servicePackage.getId(), ReportStatus.PENDING);
        return AdminHallItemResponse.fromServicePackage(servicePackage, pendingReports);
    }

    private Map<Long, Demand> loadDemands(List<HallItemId> items) {
        List<Long> ids = items.stream()
                .filter(item -> item.type() == AdminHallItemType.DEMAND)
                .map(HallItemId::id)
                .toList();
        return demandRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Demand::getId, Function.identity()));
    }

    private Map<Long, ServicePackage> loadServices(List<HallItemId> items) {
        List<Long> ids = items.stream()
                .filter(item -> item.type() == AdminHallItemType.SERVICE_PACKAGE)
                .map(HallItemId::id)
                .toList();
        return servicePackageRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(ServicePackage::getId, Function.identity()));
    }

    private void validatePage(int page, int size) {
        if (page < 1 || size < 1 || size > 100) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "page must be at least 1 and size must be between 1 and 100");
        }
    }

    private String normalizeKeyword(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return null;
        }
        String normalized = keyword.trim();
        if (normalized.length() > 100) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "keyword is too long");
        }
        return normalized;
    }
}
