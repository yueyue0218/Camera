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
        return toCard(servicePackage, null);
    }

    public static ServicePackageCardDto toCard(ServicePackage servicePackage, PhotographerInfo photographerInfo) {
        List<Long> portfolioIds = servicePackage.getPortfolioIds();
        Long coverPortfolioId = portfolioIds == null || portfolioIds.isEmpty() ? null : portfolioIds.get(0);
        List<String> images = servicePackage.getImages();
        String coverImage = images == null || images.isEmpty() ? null : images.get(0);
        return new ServicePackageCardDto(
                servicePackage.getId(),
                servicePackage.getProviderId(),
                photographerId(servicePackage, photographerInfo),
                nickname(photographerInfo),
                avatarFileId(photographerInfo),
                avatarUrl(photographerInfo),
                creditScore(photographerInfo),
                servicePackage.getTitle(),
                servicePackage.getCityCode(),
                servicePackage.getScene(),
                servicePackage.getStyleTags(),
                coverImage,
                images,
                servicePackage.getBasePriceCent(),
                servicePackage.getPriceRange(),
                servicePackage.getDurationMinutes(),
                coverPortfolioId,
                portfolioIds,
                servicePackage.getStatus().name(),
                servicePackage.getIsAvailable(),
                servicePackage.getAvailableDates(),
                servicePackage.getTimeDescription(),
                servicePackage.getTimeTags(),
                servicePackage.getCreatedAt(),
                servicePackage.getUpdatedAt()
        );
    }

    public static ServicePackageDetailDto toDetail(ServicePackage servicePackage) {
        return toDetail(servicePackage, null);
    }

    public static ServicePackageDetailDto toDetail(ServicePackage servicePackage, PhotographerInfo photographerInfo) {
        return new ServicePackageDetailDto(
                servicePackage.getId(),
                servicePackage.getProviderId(),
                photographerId(servicePackage, photographerInfo),
                nickname(photographerInfo),
                avatarFileId(photographerInfo),
                avatarUrl(photographerInfo),
                creditScore(photographerInfo),
                servicePackage.getTitle(),
                servicePackage.getCityCode(),
                servicePackage.getServiceArea(),
                servicePackage.getScene(),
                servicePackage.getStyleTags(),
                servicePackage.getImages(),
                servicePackage.getBasePriceCent(),
                servicePackage.getPriceRange(),
                servicePackage.getDurationMinutes(),
                servicePackage.getOriginalCount(),
                servicePackage.getRefinedCount(),
                servicePackage.getDeliveryDays(),
                servicePackage.getAvailableDates(),
                servicePackage.getPortfolioIds(),
                servicePackage.getDescription(),
                servicePackage.getTimeDescription(),
                servicePackage.getTimeTags(),
                servicePackage.getStatus().name(),
                servicePackage.getIsAvailable(),
                servicePackage.getCreatedAt(),
                servicePackage.getUpdatedAt()
        );
    }

    private static Long photographerId(ServicePackage servicePackage, PhotographerInfo photographerInfo) {
        return photographerInfo == null ? servicePackage.getProviderId() : photographerInfo.photographerId();
    }

    private static String nickname(PhotographerInfo photographerInfo) {
        return photographerInfo == null ? null : photographerInfo.nickname();
    }

    private static Long avatarFileId(PhotographerInfo photographerInfo) {
        return photographerInfo == null ? null : photographerInfo.avatarFileId();
    }

    private static String avatarUrl(PhotographerInfo photographerInfo) {
        return photographerInfo == null ? null : photographerInfo.avatarUrl();
    }

    private static java.math.BigDecimal creditScore(PhotographerInfo photographerInfo) {
        return photographerInfo == null ? null : photographerInfo.creditScore();
    }
}
