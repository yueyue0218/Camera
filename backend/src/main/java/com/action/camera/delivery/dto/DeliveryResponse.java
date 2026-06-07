package com.action.camera.delivery.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class DeliveryResponse {

    private Long deliveryId;
    private Long orderId;
    private Integer deliveryRound;
    private Boolean isLatest;
    private Integer originalCount;
    private Integer refinedCount;
    private Long fileId;
    private String fileName;
    private String status;
    private String remark;
    private LocalDateTime uploadTime;
}
