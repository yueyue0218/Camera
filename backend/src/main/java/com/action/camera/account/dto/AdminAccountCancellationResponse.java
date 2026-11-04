package com.action.camera.account.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class AdminAccountCancellationResponse {
    private Long requestId;
    private Long userId;
    private String status;
    private String reason;
    private LocalDateTime requestedAt;
    private LocalDateTime updatedAt;
    private LocalDateTime processedAt;
    private String resolutionNote;
}
