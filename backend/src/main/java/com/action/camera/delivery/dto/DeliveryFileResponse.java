package com.action.camera.delivery.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class DeliveryFileResponse {

    private Long fileId;
    private String fileName;
    private String mimeType;
    private Long fileSize;
    private String fileType;
    private Integer sortOrder;
}
