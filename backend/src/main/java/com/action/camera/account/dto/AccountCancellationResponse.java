package com.action.camera.account.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class AccountCancellationResponse {
    private Long requestId;
    private String status;
    private String reason;
    private LocalDateTime requestedAt;
    private LocalDateTime updatedAt;
    private LocalDateTime processedAt;
    private String resolutionNote;
}
