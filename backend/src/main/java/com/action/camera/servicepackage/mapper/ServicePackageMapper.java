package com.action.camera.servicepackage.mapper;

import com.action.camera.servicepackage.domain.ServicePackage;
import com.action.camera.servicepackage.dto.CreateServicePackageResult;
import com.action.camera.servicepackage.dto.ServicePackageCardDto;
import com.action.camera.servicepackage.dto.ServicePackageDetailDto;

import java.util.List;

public final class ServicePackageMapper {

    private ServicePackageMapper() {
    }

    public static CreateServicePackageResult toCreateResult(ServicePackage servicePackage) {
        return new CreateServicePackageResult(
                servicePackage.getId(),
                servicePackage.getStatus().name(),
                servicePackage.getIsAvailable()
        );
    }

    public static ServicePackageCardDto toCard(ServicePackage servicePackage) {
        List<Long> portfolioIds = servicePackage.getPortfolioIds();
        Long coverPortfolioId = portfolioIds == null || portfolioIds.isEmpty() ? null : portfolioIds.get(0);
        return new ServicePackageCardDto(
                servicePackage.getId(),
                servicePackage.getProviderId(),
                servicePackage.getTitle(),
                servicePackage.getCityCode(),
                servicePackage.getScene(),
                servicePackage.getStyleTags(),
                servicePackage.getBasePriceCent(),
                servicePackage.getDurationMinutes(),
                coverPortfolioId,
                portfolioIds,
                servicePackage.getStatus().name(),
                servicePackage.getIsAvailable(),
                servicePackage.getAvailableDates()
        );
    }

    public static ServicePackageDetailDto toDetail(ServicePackage servicePackage) {
        return new ServicePackageDetailDto(
                servicePackage.getId(),
                servicePackage.getProviderId(),
                servicePackage.getTitle(),
                servicePackage.getCityCode(),
                servicePackage.getServiceArea(),
                servicePackage.getScene(),
                servicePackage.getStyleTags(),
                servicePackage.getBasePriceCent(),
                servicePackage.getDurationMinutes(),
                servicePackage.getOriginalCount(),
                servicePackage.getRefinedCount(),
                servicePackage.getDeliveryDays(),
                servicePackage.getAvailableDates(),
                servicePackage.getPortfolioIds(),
                servicePackage.getDescription(),
                servicePackage.getStatus().name(),
                servicePackage.getIsAvailable(),
                servicePackage.getCreatedAt(),
                servicePackage.getUpdatedAt()
        );
    }
}
