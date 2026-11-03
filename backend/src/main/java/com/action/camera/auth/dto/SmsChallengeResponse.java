package com.action.camera.auth.dto;
import java.time.LocalDateTime;
public record SmsChallengeResponse(String challengeId, LocalDateTime expiresAt) { }
