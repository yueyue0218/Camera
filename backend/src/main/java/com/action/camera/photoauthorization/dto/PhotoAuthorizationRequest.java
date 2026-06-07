package com.action.camera.photoauthorization.dto;

import lombok.Data;

import java.util.List;

@Data
public class PhotoAuthorizationRequest {

    private List<Long> fileIds;

    private String remark;
}
