package com.action.camera.servicepackage.mapper;

import java.math.BigDecimal;

public record PhotographerInfo(
        Long photographerId,
        String nickname,
        Long avatarFileId,
        String avatarUrl,
        BigDecimal creditScore
) {
}
