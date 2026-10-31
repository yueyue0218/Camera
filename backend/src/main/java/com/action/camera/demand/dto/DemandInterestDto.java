package com.action.camera.demand.dto;

import java.time.LocalDateTime;

/** A tombstone retains only the user's own target ID, never removed/private demand content. */
public record DemandInterestDto(Long interestId, Long demandId, String targetType,
                                boolean interested, String status, DemandDto demand,
                                LocalDateTime createdAt) { }
