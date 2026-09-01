package com.action.camera.photoauthorization.dto;

import com.action.camera.delivery.entity.DeliveryFile;
import com.action.camera.domain.FileRecord;
import com.action.camera.photoauthorization.entity.PhotoAuthorization;
import com.action.camera.photoauthorization.entity.PhotoAuthorizationFile;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class PhotoAuthorizationResponse {

    private Long id;

    private Long orderId;

    private Long customerId;

    private Long providerUserId;

    private String photoUsageScope;

    private String status;

    private String remark;

    private LocalDateTime authorizedAt;

    private LocalDateTime expireTime;

    private List<PhotoAuthorizationFileResponse> files;

    public static PhotoAuthorizationResponse from(
            PhotoAuthorization authorization,
            List<PhotoAuthorizationFile> files
    ) {
        return from(authorization, files, java.util.Map.of());
    }

    public static PhotoAuthorizationResponse from(
            PhotoAuthorization authorization,
            List<PhotoAuthorizationFile> files,
            java.util.Map<Long, FileMetadata> metadataByFileId
    ) {
        return PhotoAuthorizationResponse.builder()
                .id(authorization.getId())
                .orderId(authorization.getOrderId())
                .customerId(authorization.getCustomerId())
                .providerUserId(authorization.getProviderUserId())
                .photoUsageScope(authorization.getPhotoUsageScope())
                .status(authorization.getStatus())
                .remark(authorization.getRemark())
                .authorizedAt(authorization.getAuthorizedAt())
                .expireTime(authorization.getExpireTime())
                .files(files.stream()
                        .map(file -> {
                            FileMetadata metadata = metadataByFileId.get(file.getFileId());
                            return PhotoAuthorizationFileResponse.from(
                                    file,
                                    metadata == null ? null : metadata.record(),
                                    metadata == null ? null : metadata.deliveryFile()
                            );
                        })
                        .toList())
                .build();
    }

    public record FileMetadata(
            FileRecord record,
            DeliveryFile deliveryFile
    ) {
    }
}
