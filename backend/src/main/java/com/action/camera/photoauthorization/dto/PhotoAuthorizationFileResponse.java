package com.action.camera.photoauthorization.dto;

import com.action.camera.photoauthorization.entity.PhotoAuthorizationFile;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class PhotoAuthorizationFileResponse {

    private Long id;

    private Long fileId;

    private Integer sortOrder;

    public static PhotoAuthorizationFileResponse from(PhotoAuthorizationFile file) {
        return PhotoAuthorizationFileResponse.builder()
                .id(file.getId())
                .fileId(file.getFileId())
                .sortOrder(file.getSortOrder())
                .build();
    }
}
