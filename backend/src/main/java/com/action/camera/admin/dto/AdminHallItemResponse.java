package com.action.camera.admin.dto;

import com.action.camera.demand.domain.Demand;
import com.action.camera.servicepackage.domain.ServicePackage;

import java.time.LocalDateTime;
import java.util.List;

public record AdminHallItemResponse(
        String type,
        Long id,
        Long publisherId,
        String title,
        String description,
        String scene,
        String cityCode,
        List<String> styleTags,
        Long priceCent,
        String coverImage,
        String businessStatus,
        String moderationStatus,
        Long moderatedBy,
        LocalDateTime moderatedAt,
        String moderationReason,
        long pendingReportCount,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {

    public static AdminHallItemResponse fromDemand(Demand demand, long pendingReportCount) {
        return new AdminHallItemResponse(
                AdminHallItemType.DEMAND.name(),
                demand.getId(),
                demand.getCustomerId(),
                demand.getScene(),
                demand.getDescription(),
                demand.getScene(),
                demand.getCityCode(),
                demand.getStyleTags(),
                demand.getBudgetMinCent() == null ? null : demand.getBudgetMinCent().longValue(),
                null,
                demand.getStatus().name(),
                demand.getModerationStatus().name(),
                demand.getModeratedBy(),
                demand.getModeratedAt(),
                demand.getModerationReason(),
                pendingReportCount,
                demand.getCreatedAt(),
                demand.getUpdatedAt());
    }

    public static AdminHallItemResponse fromServicePackage(ServicePackage servicePackage,
                                                           long pendingReportCount) {
        List<String> images = servicePackage.getImages();
        return new AdminHallItemResponse(
                AdminHallItemType.SERVICE_PACKAGE.name(),
                servicePackage.getId(),
                servicePackage.getProviderId(),
                servicePackage.getTitle(),
                servicePackage.getDescription(),
                servicePackage.getScene(),
                servicePackage.getCityCode(),
                servicePackage.getStyleTags(),
                servicePackage.getBasePriceCent(),
                images == null || images.isEmpty() ? null : images.get(0),
                servicePackage.getStatus().name(),
                servicePackage.getModerationStatus().name(),
                servicePackage.getModeratedBy(),
                servicePackage.getModeratedAt(),
                servicePackage.getModerationReason(),
                pendingReportCount,
                servicePackage.getCreatedAt(),
                servicePackage.getUpdatedAt());
    }
}
