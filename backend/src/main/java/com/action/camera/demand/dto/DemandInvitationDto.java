package com.action.camera.demand.dto;

import java.time.LocalDateTime;

public class DemandInvitationDto {

    private final Long invitationId;
    private final Long demandId;
    private final Long customerId;
    private final Long providerId;
    private final String demandScene;
    private final String message;
    private final Integer expectedPriceCent;
    private final LocalDateTime createdAt;
    private final String status;
    private final Long responseId;
    private final LocalDateTime acceptedAt;
    private final LocalDateTime rejectedAt;

    public DemandInvitationDto(Long invitationId,
                               Long demandId,
                               Long customerId,
                               Long providerId,
                               String demandScene,
                               String message,
                               Integer expectedPriceCent,
                               LocalDateTime createdAt) {
        this(invitationId, demandId, customerId, providerId, demandScene, message,
                expectedPriceCent, createdAt, "PENDING", null, null, null);
    }

    public DemandInvitationDto(Long invitationId,
                               Long demandId,
                               Long customerId,
                               Long providerId,
                               String demandScene,
                               String message,
                               Integer expectedPriceCent,
                               LocalDateTime createdAt,
                               String status,
                               Long responseId,
                               LocalDateTime acceptedAt,
                               LocalDateTime rejectedAt) {
        this.invitationId = invitationId;
        this.demandId = demandId;
        this.customerId = customerId;
        this.providerId = providerId;
        this.demandScene = demandScene;
        this.message = message;
        this.expectedPriceCent = expectedPriceCent;
        this.createdAt = createdAt;
        this.status = status;
        this.responseId = responseId;
        this.acceptedAt = acceptedAt;
        this.rejectedAt = rejectedAt;
    }

    public DemandInvitationDto accepted(Long acceptedResponseId, LocalDateTime time) {
        return new DemandInvitationDto(invitationId, demandId, customerId, providerId, demandScene, message,
                expectedPriceCent, createdAt, "ACCEPTED", acceptedResponseId, time, rejectedAt);
    }

    public DemandInvitationDto rejected(LocalDateTime time) {
        return new DemandInvitationDto(invitationId, demandId, customerId, providerId, demandScene, message,
                expectedPriceCent, createdAt, "REJECTED", responseId, acceptedAt, time);
    }

    public Long getInvitationId() {
        return invitationId;
    }

    public Long getDemandId() {
        return demandId;
    }

    public Long getCustomerId() {
        return customerId;
    }

    public Long getProviderId() {
        return providerId;
    }

    public String getDemandScene() {
        return demandScene;
    }

    public String getMessage() {
        return message;
    }

    public Integer getExpectedPriceCent() {
        return expectedPriceCent;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public String getStatus() {
        return status;
    }

    public Long getResponseId() {
        return responseId;
    }

    public LocalDateTime getAcceptedAt() {
        return acceptedAt;
    }

    public LocalDateTime getRejectedAt() {
        return rejectedAt;
    }
}
