package com.action.camera.photoauthorization.dto;

import com.action.camera.delivery.entity.DeliveryFile;
import com.action.camera.domain.FileRecord;
import com.action.camera.photoauthorization.entity.PhotoAuthorizationFile;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class PhotoAuthorizationFileResponse {

    private Long id;

    private Long fileId;

    private Long deliveryId;

    private String fileName;

    private String fileType;

    private String mimeType;

    private Long size;

    private Long fileSize;

    private Integer sortOrder;

    public static PhotoAuthorizationFileResponse from(PhotoAuthorizationFile file) {
        return from(file, null, null);
    }

    public static PhotoAuthorizationFileResponse from(
            PhotoAuthorizationFile file,
            FileRecord record,
            DeliveryFile deliveryFile
    ) {
        Long size = record == null ? null : record.getFileSize();
        return PhotoAuthorizationFileResponse.builder()
                .id(file.getId())
                .fileId(file.getFileId())
                .deliveryId(deliveryFile == null ? null : deliveryFile.getDeliveryId())
                .fileName(record == null ? null : record.getOriginalName())
                .fileType(deliveryFile == null ? null : deliveryFile.getFileType())
                .mimeType(record == null ? null : record.getMimeType())
                .size(size)
                .fileSize(size)
                .sortOrder(file.getSortOrder())
                .build();
    }
}
