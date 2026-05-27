package com.action.camera.demand.service;

import com.action.camera.demand.domain.Demand;
import com.action.camera.demand.domain.DemandResponse;
import com.action.camera.demand.dto.DemandDto;
import com.action.camera.demand.dto.DemandResponseDto;

final class DemandMapper {

    private DemandMapper() {
    }

    static DemandDto toDemandDto(Demand demand) {
        return new DemandDto(
                demand.getId(),
                demand.getCustomerId(),
                demand.getScene(),
                demand.getStyleTags(),
                demand.getExpectedDate(),
                demand.getTimeSlot(),
                demand.getCityCode(),
                demand.getLocation(),
                demand.getBudgetMinCent(),
                demand.getBudgetMaxCent(),
                demand.getDescription(),
                demand.getStatus().name(),
                demand.getResponseCount(),
                demand.getReferenceFileIds(),
                demand.getCreatedAt(),
                demand.getUpdatedAt()
        );
    }

    static DemandResponseDto toResponseDto(DemandResponse response) {
        return new DemandResponseDto(
                response.getId(),
                response.getDemandId(),
                response.getProviderId(),
                response.getProviderProfileId(),
                response.getMessage(),
                response.getExpectedPriceCent(),
                response.getStatus().name(),
                response.getRejectReason(),
                response.getResponseTime()
        );
    }
}
