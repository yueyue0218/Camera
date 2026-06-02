package com.action.camera.servicepackage.mapper;

public record PhotographerInfo(
        Long photographerId,
        String nickname,
        Long avatarFileId,
        String avatarUrl
) {
}
