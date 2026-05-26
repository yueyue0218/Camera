package com.action.camera.delivery.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class DeliveryUploadResponse {

    private Long deliveryId;
    private Long orderId;
    private Integer deliveryRound;
    private String fileKey;
    private String fileName;
    private Long uploadedBy;
    private LocalDateTime uploadTime;
    private String orderStatus;
}
