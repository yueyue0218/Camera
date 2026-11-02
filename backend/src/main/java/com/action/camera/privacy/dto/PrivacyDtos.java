package com.action.camera.privacy.dto;

import jakarta.validation.constraints.*;
import java.time.LocalDateTime;

public final class PrivacyDtos {
    private PrivacyDtos() {}
    public record ConsentUpdate(@NotBlank @Pattern(regexp="GRANTED|WITHDRAWN") String status,
            @NotBlank @Size(max=40) String privacyPolicyVersion,
            @NotBlank @Size(max=40) String crossBorderConsentVersion,
            @NotBlank @Size(max=128) String installationId,
            @NotNull @Positive Long acceptedAtEpochMs) {}
    public record ConsentView(String status,String consentType,String privacyPolicyVersion,
            String crossBorderConsentVersion,String installationId,Long acceptedAtEpochMs,LocalDateTime occurredAt,Long userId) {}
    public record RightCreate(@NotBlank @Pattern(regexp="ACCESS|COPY|CORRECT|DELETE") String type,
            @NotBlank @Size(max=2000) String description,
            @NotBlank @Pattern(regexp="[A-Za-z0-9_-]{16,64}") String idempotencyKey) {}
    public record RightUpdate(@NotBlank @Pattern(regexp="PROCESSING|COMPLETED|REJECTED") String status,
            @NotBlank @Size(max=2000) String resolutionNote,
            Boolean verifiedIdentity, @Size(max=500) String verificationNote) {}
    public record RightView(Long id,Long userId,String type,String description,String status,
            LocalDateTime submittedAt,LocalDateTime updatedAt,String resolutionNote,
            LocalDateTime processedAt,LocalDateTime responseDueAt) {}
    public record ClosureCode(@NotBlank @Size(max=32) String phone,@NotBlank @Size(max=128) String deviceId) {}
    public record ClosureConfirm(@NotBlank @Size(max=32) String phone,
            @NotBlank @Pattern(regexp="[0-9]{6}") String code,@NotNull @AssertTrue Boolean confirmed) {}
    public record ClosureView(String status, LocalDateTime closedAt, String retainedDataNotice) {}
}
