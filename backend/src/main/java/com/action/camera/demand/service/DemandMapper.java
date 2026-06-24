package com.action.camera.demand.service;

import com.action.camera.demand.domain.Demand;
import com.action.camera.demand.domain.DemandResponse;
import com.action.camera.demand.dto.DemandDto;
import com.action.camera.demand.dto.DemandResponseDto;

final class DemandMapper {

    private DemandMapper() {
    }

    static DemandDto toDemandDto(Demand demand) {
        return toDemandDto(demand, null, null, null, null);
    }

    static DemandDto toDemandDto(Demand demand, CustomerInfo customerInfo) {
        return toDemandDto(demand, customerInfo, null, null, null);
    }

    static DemandDto toDemandDto(Demand demand, CustomerInfo customerInfo, java.util.List<String> recommendReasons) {
        return toDemandDto(demand, customerInfo, null, null, null, recommendReasons);
    }

    static DemandDto toDemandDto(Demand demand,
                                 Integer pendingCount,
                                 Integer acceptedCount,
                                 Integer rejectedCount) {
        return toDemandDto(demand, null, pendingCount, acceptedCount, rejectedCount);
    }

    static DemandDto toDemandDto(Demand demand,
                                 CustomerInfo customerInfo,
                                 Integer pendingCount,
                                 Integer acceptedCount,
                                 Integer rejectedCount) {
        return toDemandDto(demand, customerInfo, pendingCount, acceptedCount, rejectedCount, null);
    }

    static DemandDto toDemandDto(Demand demand,
                                 CustomerInfo customerInfo,
                                 Integer pendingCount,
                                 Integer acceptedCount,
                                 Integer rejectedCount,
                                 java.util.List<String> recommendReasons) {
        return new DemandDto(
                demand.getId(),
                demand.getCustomerId(),
                customerInfo == null ? null : customerInfo.nickname(),
                customerInfo == null ? null : customerInfo.avatarFileId(),
                demand.getScene(),
                demand.getStyleTags(),
                demand.getExpectedDate(),
                demand.getTimeSlot(),
                demand.getTimeDescription(),
                demand.getTimeTags(),
                demand.getCityCode(),
                demand.getLocation(),
                demand.getBudgetMinCent(),
                demand.getBudgetMaxCent(),
                demand.getDescription(),
                demand.getStatus().name(),
                demand.getResponseCount(),
                pendingCount,
                acceptedCount,
                rejectedCount,
                demand.getReferenceFileIds(),
                recommendReasons,
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

record CustomerInfo(String nickname, Long avatarFileId) {
}
